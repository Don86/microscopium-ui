var _ = require('lodash');
var d3 = require('d3');
var byteFlag = require('./utils/Byteflag.js');
var status = require('./enums/sampleStatus');
var utils = require('./utils/Utils.js');

/**
 * SampleManager: Manages updating of sample status flags and queries on data.
 *
 * @param data
 * @constructor
 */
function SampleManager(data) {
    this.data = data;

    this.view = 'tsne';

    // create a hash table to quickly find indices from sample id's
    this.sampleIDhash = {};

    // generate and save a reference to an array [0, 1, ..., n] where
    // n is the length of the dataset
    this.allIndices = _.range(this.data.length);

    this.data.forEach(function(d, i) {
        // add index as property to all items -- need these to preserve original ordering
        // of data from input array
        d.i = i;

        // add status byteflag -- init as 0
        d.status = 0;

        // populate hash table
        this.sampleIDhash[d._id] = i;
    }.bind(this));

    this._setQuadtree();
}

/**
 * findSampleFromMouse: Find index of sample closest to mouse co-ordinates.
 *
 * Queries the quadtree data structure to find the closest point to the
 * given mouse-coordinates. If the point is within the given radius, the index
 * of the point is returned, -1 otherwise.
 *
 * @param mouse {Array} - Mouse object, usually generated by d3 from the
 *     d3.mouse(this) method during an event. First co-ordinate represents
 *     the x position of the mouse, second co-ordinate represents the y
 *     co-ordinate.
 * @param r {number} - The radius to search in.
 * @returns {number} - Index of query sample, -1 if not sample found in query radius.
 */
SampleManager.prototype.findSampleFromMouse = function(mouse, r) {
    // find closest point to given (xd, yd) pair
    // need to apply the scale used to make sure we're working
    // in the right co-ordinate space
    var xInverse = this.xScale.invert(mouse[0]);
    var yInverse = this.yScale.invert(mouse[1]);

    var nearest = this.quadTree.find([xInverse, yInverse]);

    // closest point must be within given radius ie "was the point clicked on?"
    // only want to register hits within radius of circle, so we
    // need to work in the space of the plot that called this method
    var xNearest = this.xScale(nearest.dimension_reduce[this.view][0]);
    var yNearest = this.yScale(nearest.dimension_reduce[this.view][1]);
    var distance = utils.euclideanDistance(mouse[0], mouse[1],
        xNearest, yNearest);

    // if the distance is within the point radius, update the index of
    // the current active sample
    return distance < r ? nearest.i : -1;
};

/**
 * getIndexFromID: Return array indices from sampleID(s).
 *
 * @param sampleID {string|Array} - A string to get the index for a single sampleID,
 *     or an array of strings to query multiple indices.
 * @returns {Number|Array} - The query index or indices.
 */
SampleManager.prototype.getIndexFromID = function(sampleID) {
    if(sampleID instanceof Array) {
        var i, id;
        var indices = new Array(sampleID.length);

        for(i = 0; i < sampleID.length; i++) {
            id = sampleID[i];
            indices[i] = this.sampleIDhash[id];
        }

        return indices;
    }
    else {
        return this.sampleIDhash[sampleID];
    }

};

/**
 * setView: Change the current view for the plot.
 *
 * @param view {string} - The current view for the plot. Should be one
 *     'tsne' or 'pca'.
 */
SampleManager.prototype.setView = function(view) {
    this.view = view;
    this._setQuadtree();
};

/**
 * setScale: Update the scale currently used for querying the data.
 *
 * @param xScale
 * @param yScale
 */
SampleManager.prototype.setScale = function(xScale, yScale) {
    this.xScale = xScale;
    this.yScale = yScale;
};

/**
 * setStatusToIndex: Set a status flag to a set of indices.
 *
 * Remove the status flag from all samples, and add the status
 * flag to samples with the given index (or indices).
 *
 * @param index {number|Array} - The index or indices to update.
 * @param status {number} The status to add to a sample. Should be from the
 *    sampleStatus enum.
 */
SampleManager.prototype.setStatusToIndex = function(index, status) {
    // TODO: optimise this
    // can probably optimise this by remembering the last indices
    // that had this flag added to them and removing those, rather
    // than iterating the array
    this.data.forEach(function(d) {
        d.status = byteFlag.remove(d.status, status);
    });

    if(index instanceof Array) {
        var i, ii;
        for(i = 0; i < index.length; i++) {
            ii = index[i];
            this.data[ii].status =
                byteFlag.add(this.data[ii].status, status);
        }
    }
    else {
        this.data[index].status =
            byteFlag.add(this.data[index].status, status);
    }
};

/**
 * setQuadtree: Create the quadtree used for fast spatial queries.
 *
 * Should be called when the scatterplot view changes.
 *
 * @private
 */
SampleManager.prototype._setQuadtree = function() {
    // create new instance of quadtree with required accessors
    var newTree = d3.geom.quadtree()
        .x(function(d) {
            return d.dimension_reduce[this.view][0];
        }.bind(this))
        .y(function(d) {
            return d.dimension_reduce[this.view][1];
        }.bind(this));

    // add data to quadtree
    this.quadTree = newTree(this.data);
};

module.exports = SampleManager;
