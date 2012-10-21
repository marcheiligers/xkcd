// The world's smallest SVG lib
(function(global, undefined) {
  var NS = 'http://www.w3.org/2000/svg'

  global.Svg = function(el, w, h) {
    this.el = el
    this.width = w
    this.height = h

    this.svg = document.createElementNS(NS, 'svg')
    setAttr(this.svg, { width: w, height: h, style: 'position:relative;overflow:hidden;'})
    this.el.appendChild(this.svg)

    this.boundingBox = { x0: -1, y0: -1, x1: 1, y1: 1 }
  }

  Svg.prototype.bounds = function(value) {
    if(value) {
      this.boundingBox = value
      return this
    } else {
      return this.boundingBox
    }
  }

  Svg.prototype.path = function(points, attr) {
    var path = document.createElementNS(NS, 'path')
    setAttr(path, attr, { 'd': toPath(points, this.boundingBox, this.width, this.height, 20), 'stroke': 'black', 'fill': 'none' })
    this.svg.appendChild(path)
  }

  Svg.prototype.clear = function() {
    for(var i = this.svg.childNodes.length - 1; i >= 0; --i) {
      this.svg.removeChild(this.svg.childNodes[i])
    }
  }

  function setAttr(el, attr, defs) {
    if(attr) {
      for(a in attr) {
        el.setAttribute(a, attr[a])
      }
    }
    if(defs) {
      for(a in defs) {
        if(!attr || !attr[a]) {
          el.setAttribute(a, defs[a])
        }
      }
    }
  }

  function toPath(points, bounds, w, h, margin) {
    var scaled = scaleTo(points, bounds, w, h, margin)
    var path = [ "M", scaled[0].x, scaled[0].y ]
    for(var i = 1; i < scaled.length; ++i) {
      path.push("L", scaled[i].x, scaled[i].y)
    }
    return path.join(' ')
  }

  function scaleTo(points, bounds, w, h) {
    var result = [],
        xl = bounds.x1 - bounds.x0,
        yl = bounds.y1 - bounds.y0,
        xr = w / xl,
        yr = h / yl

    for(var i = 0; i < points.length; ++i) {
      result.push({ 
        x: (points[i].x - bounds.x0) * xr,
        y: (points[i].y - bounds.y0) * yr
      })
    }

    return result
  }

})(this)