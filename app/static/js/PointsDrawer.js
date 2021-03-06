'use strict';

var _ = require('lodash');
var byteFlag = require('./utils/Byteflag.js');
var pointStatus = require('./enums/sampleStatus.js');
var config = require('../config/plots').neighbourPlot;

/**
 * PointsDrawer: Draw points using the HTML5 canvas.
 *
 * @param canvas {HTMLCanvasElement}
 * @constructor
 */
function PointsDrawer(canvas) {
    this.width = canvas.node().width;
    this.height = canvas.node().height;
    this.context = canvas.node().getContext('2d');

    this.overlay = 'None';
}

/**
 * redraw: Clear the current canvas context and draw the desired points.
 *
 * After clearing the canvas context, this function checks the current
 * status of each sample (active, selected, etc.), and updates the context
 * so each point is styled accordingly.
 *
 * @param data {SampleManager} - A SampleManager object wrapping the data.
 * @param indices {Array} - The indices of the samples to be drawn.
 */
PointsDrawer.prototype.redraw = function (data, indices) {
    this.context.clearRect(0, 0, this.width, this.height);
    var i, ii, point, drawIndex, active;
    var neighbours = [];
    var unStyled = [];
    var filteredOut = [];

    if(!_.isNull(indices) && !_.isUndefined(indices)) {
        // if a set of indices has been supplied, set the drawIndex
        // variable to reference the supplied indices
        drawIndex = indices;
    }
    else {
        // otherwise reference it to the cached array of indices
        drawIndex = data.allIndices;
    }

    // the indices of points are iterated and stored in different arrays
    // according to the their current stylings. this done for two reasons
    // a) the reduce the number of calls to the canvas context (this enables
    //    (for faster drawing in the canvas)
    // b) to enforce a draw order, we want active and neighbouring
    //    points to be drawn last so they appear at the "top" of the scatterplot
    for(i = 0; i < drawIndex.length; i++) {
        ii = drawIndex[i];
        point = data.data[ii];

        if(byteFlag.check(point.status, pointStatus.ACTIVE)) {
            active = ii;
        }
        else if(byteFlag.check(point.status, pointStatus.NEIGHBOUR)) {
            neighbours.push(ii);
        }
        else if(!byteFlag.check(point.status, pointStatus.FILTERED_OUT)) {
            unStyled.push(ii);
        }
        else {
            filteredOut.push(ii);
        }
    }

    if(filteredOut.length > 0) {
        this._drawPoints(data, filteredOut, config.pointStyle.filteredOut);
    }

    if(unStyled.length > 0) {
        this._drawPoints(data, unStyled, config.pointStyle.defaultStyle);
    }

    if(neighbours.length > 0) {
        // pass true as the override argument as neighbourpoints should
        // use their fill defined in the config, not as the colourscale
        this._drawPoints(data, neighbours, config.pointStyle.neighbours, true);
    }

    if(!_.isNull(active) && !_.isUndefined(active)) {
        // as above, active point should always be styled
        this._drawPoints(data, [active], config.pointStyle.active, true);
    }
};

PointsDrawer.prototype.setColourScale = function(colourScale) {
    if(_.isNull(colourScale) || _.isUndefined(colourScale)) {
        this.colourScale = null;
    }
    else {
        this.colourScale = colourScale;
    }
};

/**
 * setView: Update the current scatterplot view.
 *
 * Choose the dimensionality reduction method used to display points
 * in 2D space i.e.e PCA or TSNE.
 *
 * @param view {string} - The scatterplot view. Should be one of 'pca' or
 *     'tsne'.
 */
PointsDrawer.prototype.setView = function(view) {
    this.view = view;
};

/**
 * setScale: Set the scale currently used by the Scatterplot.
 *
 * This function should be called when the Scatterplot changes
 * the scale currently used to render points.
 *
 * @param xScale {function} - The scale to use for the x axis. Should
 *     be an instance of a d3 scale.
 * @param yScale {function} - The scale to use for the y axis. Should
 *     be an instance of a d3 scale.
 */
PointsDrawer.prototype.setScale = function(xScale, yScale) {
    this.xScale = xScale;
    this.yScale = yScale;
};

/**
 * drawPoint: Draw a point using the current scale and canvas context.
 *
 * The fillStyle of the point is taken from the canvas context prior
 * to calling the function, OR from the current overlay colour scale
 * if defined.
 *
 * @param point {object} - The point to draw.
 * @param r {number} - The radius of the point to draw.
 * @param [fill] {string} - Optional, if a fill style is explicitly
 *     defined here the colourscale will be ignored and the point
 *     will be filled with this style.
 * @private
 */
PointsDrawer.prototype._drawPoint = function(point, r, fill) {
    var cx = this.xScale(point.dimension_reduce[this.view][0]);
    var cy = this.yScale(point.dimension_reduce[this.view][1]);

    if(_.isNull(fill) || _.isUndefined(fill)) {
        // if a fill has not been explicitly defined, use the colourscale
        // if it's defined
        if(!_.isNull(this.colourScale) && !_.isUndefined(this.colourScale)) {
            this.context.fillStyle =
                this.colourScale(point.overlays[this.overlay] || 0);
        }
        // otherwise use the default fill style
        else {
            this.context.fillStyle =
                config.pointStyle.defaultStyle.fillStyle;
        }
    }
    else {
        // if a fill style is passed to the function, use it when styling
        // the point
        this.context.fillStyle = fill;
    }

    this.context.beginPath();
    this.context.arc(cx, cy, r, 0, 2 * Math.PI);
    this.context.closePath();
    this.context.stroke();
    this.context.fill();
};

/**
 * drawPoints: Draw the points.
 *
 * @param data {SampleManager} - A SampleManager object wrapping the data.
 * @param indices {Array} - The indices of the samples to be drawn.
 * @param style {object} - An object with properties fillStyle, strokeStyle,
 *     strokeWidth, globalAlpha and radius. These determine the style of the
 *     points that will be drawn by this function.
 * @param overrideFill {bool} - If true, this call to the canvas will ignore
 *     the colourScale and use the fillStyle for this point.
 * @private
 */
PointsDrawer.prototype._drawPoints = function(data, indices, style,
                                              overrideFill) {
    var i, ii;

    // update the canvas context before the points are drawn, this reduces
    // the number of style changes made to the canvas context
    this.context.strokeStyle = style.strokeStyle;
    this.context.strokeWidth = style.strokeWidth;
    this.context.globalAlpha = style.globalAlpha;

    for(i = 0; i < indices.length; i++) {
        ii = indices[i];

        if(overrideFill === true) {
            this._drawPoint(data.data[ii], style.radius, style.fillStyle);
        }
        else {
            this._drawPoint(data.data[ii], style.radius);
        }
    }
};

module.exports = PointsDrawer;
