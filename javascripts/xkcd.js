// Draw line charts like http://xkcd.com
// Started with from http://bl.ocks.org/3914862
// With some small code bits from http://prototypejs.org because I can never remember how to get computed styles
(function(global) {
  var $ = function(element) { 
    if(typeof element == "string") {
      return document.getElementById(element) 
    } 
    return element
  }

  function getStyle(element, style) {
    element = $(element);
    style = style == 'float' ? 'cssFloat' : style.camelize();
    var value = element.style[style];
    if (!value) {
      var css = document.defaultView.getComputedStyle(element, null);
      value = css ? css[style] : null;
    }
    if (style == 'opacity') return value ? parseFloat(value) : 1.0;
    return value == 'auto' ? null : value;
  }

  String.prototype.camelize = function() {
    var parts = this.split('-'), len = parts.length;
    if (len == 1) return parts[0];

    var camelized = this.charAt(0) == '-'
      ? parts[0].charAt(0).toUpperCase() + parts[0].substring(1)
      : parts[0];

    for (var i = 1; i < len; i++)
      camelized += parts[i].charAt(0).toUpperCase() + parts[i].substring(1);

    return camelized;
  }


  var Xkcd = global.Xkcd || {}
  global.Xkcd = Xkcd

  Xkcd.LineChart = function(id, options) {
    this.el = $(id)
    this.width = parseInt(getStyle(this.el, 'width'))
    this.height = parseInt(getStyle(this.el, 'height'))
    this.magnitude = options['magnitude'] || 0.003
    
    this.svg = new Svg(this.el, this.width, this.height)

    this.series = []
    this.xAxis = 0
    this.yAxis = 0
  }

  Xkcd.LineChart.prototype.addXYScatter = function(name, points, attr) {
    this.series.push({
      name: name,
      points: points,
      attr: attr
    })
  }

  Xkcd.LineChart.prototype.setXAxis = function(x) {
    this.xAxis = x
  }

  Xkcd.LineChart.prototype.setYAxis = function(y) {
    this.yAxis = y
  }

  Xkcd.LineChart.prototype.draw = function() {
    var bounds
    this.series.forEach(function(s) {
      bounds = adjustBoundsFor(bounds, s.points)
    })
    expandBoundsBy(bounds, 0.02)
    this.svg.bounds(bounds)

    this.svg.path(handDraw([ { x: bounds.x0, y: this.xAxis }, { x: bounds.x1, y: this.xAxis } ], this.magnitude / 2), { 'stroke-width': 2 })
    // Offset x values slightly because we haven't bothered handling vertical lines in straightLineFn
    this.svg.path(handDraw([ { x: this.yAxis - 0.01, y: bounds.y0 }, { x: this.yAxis + 0.01, y: bounds.y1 } ], this.magnitude), { 'stroke-width': 2 })

    this.series.forEach(function(s) {
      var result = handDraw(s.points, this.magnitude),
          outlineAttr = {
            'stroke': 'white',
            'stroke-width': s.attr['stroke-width'] ? s.attr['stroke-width'] + 4 : 5
          }

      this.svg.path(result, outlineAttr)
      this.svg.path(result, s.attr)
    }, this)
  }

  Xkcd.LineChart.prototype.clear = function() {
    this.series = []
    this.svg.clear()
  }

  function handDraw(points, magnitude, multiplier) {
    var dists = points.map(function (point, i) {
        if(i == 0) return 0.0

        var dx = point.x - points[i - 1].x,
            dy = point.y - points[i - 1].y

        return Math.sqrt(dx * dx + dy * dy)
      }),
      dist = dists.reduce(function (curr, d) { return d + curr; }, 0.0)    

    // Choose the number of interpolation points based on this distance.
    var N = Math.round(dist * (multiplier || 200));

    // Re-sample the line.
    var resampled = [];
    dists.map(function (d, i) {
        if(i == 0) return;

        var n = Math.max(3, Math.round(d / dist * N)),
            fn = straightLineFn(points[i - 1], points[i]),
            delta = (points[i].x - points[i - 1].x) / (n - 1)

        for(var j = 1, x = points[i - 1].x; j < n; ++j, x += delta) {
          resampled.push({ x: x, y: fn(x) });
        }
    });

    // Compute the gradients.
    var gradients = resampled.map(function(a, i, d) {
      if(i == 0) {
        return { x: d[1].x - d[0].x, y: d[1].y - d[0].x };
      }

      if(i == resampled.length - 1){
        return { x: d[i].x - d[i - 1].x, y: d[i].y - d[i - 1].y };
      }

      return {
        x: 0.5 * (d[i + 1].x - d[i - 1].x),
        y: 0.5 * (d[i + 1].y - d[i - 1].y)
      };
    });

    // Normalize the gradient vectors to be unit vectors.
    gradients = gradients.map(function(d) {
      var len = Math.sqrt(d.x * d.x + d.y * d.y);
      return { 
        x: d.x / len, 
        y: d.y / len
      };
    });

    // Generate some perturbations.
    var perturbations = smooth(resampled.map(d3RandomNormal()), 3);

    // Add in the perturbations and re-scale the re-sampled curve.
    var result = resampled.map(function (d, i) {
      var p = perturbations[i],
          g = gradients[i]

      return { 
        x: (d.x + magnitude * g.y * p),
        y: (d.y - magnitude * g.x * p)
      }
    })

    return result
  }

  // From here: https://github.com/mbostock/d3/blob/master/src/core/random.js
  function d3RandomNormal(µ, σ) {
    var n = arguments.length
    if (n < 2) σ = 1
    if (n < 1) µ = 0
    return function() {
      var x, y, r
      do {
        x = Math.random() * 2 - 1
        y = Math.random() * 2 - 1
        r = x * x + y * y
      } while (!r || r > 1)
      return µ + σ * x * Math.sqrt(-2 * Math.log(r) / r)
    }
  }

  // Smooth some data with a given window size.
  function smooth(d, w) {
    var result = []
    for(var i = 0, l = d.length; i < l; ++i) {
      var mn = Math.max(0, i - 5 * w),
          mx = Math.min(d.length - 1, i + 5 * w),
          s = 0.0
      result[i] = 0.0;
      for(var j = mn; j < mx; ++j) {
        var wd = Math.exp(-0.5 * (i - j) * (i - j) / w / w)
        result[i] += wd * d[j]
        s += wd
      }
      result[i] /= s
    }
    return result
  }  

  function straightLineFn(point1, point2) {
    var m = (point2.y - point1.y) / (point2.x - point1.x),
        c = point1.y - m * point1.x
    return function(x) {
      return m * x + c
    }
  }

  function adjustBoundsFor(bounds, points) {
    bounds = bounds || { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    for(var i = 0; i < points.length; ++i) {
      if(points[i].x < bounds.x0) bounds.x0 = points[i].x
      if(points[i].x > bounds.x1) bounds.x1 = points[i].x
      if(points[i].y < bounds.y0) bounds.y0 = points[i].y
      if(points[i].y > bounds.y1) bounds.y1 = points[i].y
    }
    return bounds;
  }

  function expandBoundsBy(bounds, multiplier) {
    var dx = (bounds.x1 - bounds.x0) * multiplier,
        dy = (bounds.y1 - bounds.y0) * multiplier

    bounds.x0 -= dx
    bounds.x1 += dx
    bounds.y0 -= dy
    bounds.y1 += dy

    return bounds 
  }

})(this, undefined)