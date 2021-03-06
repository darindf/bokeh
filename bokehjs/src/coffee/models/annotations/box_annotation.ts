/* XXX: partial */
import {Annotation, AnnotationView} from "./annotation";
import {Signal} from "core/signaling";
import {show, hide} from "core/dom";
import * as p from "core/properties";
import {isString, isArray} from "core/util/types"

export class BoxAnnotationView extends AnnotationView {
  initialize(options: any): void {
    super.initialize(options);
    this.plot_view.canvas_overlays.appendChild(this.el);
    this.el.classList.add("bk-shading");
    hide(this.el);
  }

  connect_signals(): void {
    super.connect_signals()
    // need to respond to either normal BB change events or silent
    // "data only updates" that tools might want to use
    if (this.model.render_mode === 'css') {
      // dispatch CSS update immediately
      this.connect(this.model.change, () => this.render())
      this.connect(this.model.data_update, () => this.render())
    } else {
      this.connect(this.model.change, () => this.plot_view.request_render())
      this.connect(this.model.data_update, () => this.plot_view.request_render())
    }
  }

  render() {
    if (!this.model.visible && (this.model.render_mode === 'css')) {
      hide(this.el);
    }
    if (!this.model.visible) {
      return;
    }

    // don't render if *all* position are null
    if ((this.model.left == null) && (this.model.right == null) && (this.model.top == null) && (this.model.bottom == null)) {
      hide(this.el);
      return null;
    }

    const { frame } = this.plot_model;
    const xscale = frame.xscales[this.model.x_range_name];
    const yscale = frame.yscales[this.model.y_range_name];

    const _calc_dim = (dim, dim_units, scale, view, frame_extrema) => {
      let sdim;
      if (dim != null) {
        if (this.model.screen) {
          sdim = dim;
        } else {
          if (dim_units === 'data') {
            sdim = scale.compute(dim);
          } else {
            sdim = view.compute(dim);
          }
        }
      } else {
        sdim = frame_extrema;
      }
      return sdim;
    };

    const sleft   = _calc_dim(this.model.left,   this.model.left_units,   xscale, frame.xview, frame._left.value);
    const sright  = _calc_dim(this.model.right,  this.model.right_units,  xscale, frame.xview, frame._right.value);
    const stop    = _calc_dim(this.model.top,    this.model.top_units,    yscale, frame.yview, frame._top.value);
    const sbottom = _calc_dim(this.model.bottom, this.model.bottom_units, yscale, frame.yview, frame._bottom.value);

    const draw = this.model.render_mode === 'css' ? this._css_box.bind(this) : this._canvas_box.bind(this);
    return draw(sleft, sright, sbottom, stop);
  }

  _css_box(sleft, sright, sbottom, stop) {
    const sw = Math.abs(sright-sleft);
    const sh = Math.abs(sbottom-stop);

    this.el.style.left = `${sleft}px`;
    this.el.style.width = `${sw}px`;
    this.el.style.top = `${stop}px`;
    this.el.style.height = `${sh}px`;
    this.el.style.borderWidth = `${this.model.line_width.value}px`;
    this.el.style.borderColor = this.model.line_color.value;
    this.el.style.backgroundColor = this.model.fill_color.value;
    this.el.style.opacity = this.model.fill_alpha.value;

    // try our best to honor line dashing in some way, if we can
    let ld = this.model.line_dash;
    if (isArray(ld)) {
      ld = ld.length < 2 ? "solid" : "dashed";
    }
    if (isString(ld)) {
      this.el.style.borderStyle = ld;
    }

    return show(this.el);
  }

  _canvas_box(sleft, sright, sbottom, stop) {
    const { ctx } = this.plot_view.canvas_view;
    ctx.save();

    ctx.beginPath();
    ctx.rect(sleft, stop, sright-sleft, sbottom-stop);

    this.visuals.fill.set_value(ctx);
    ctx.fill();

    this.visuals.line.set_value(ctx);
    ctx.stroke();

    return ctx.restore();
  }
}

export class BoxAnnotation extends Annotation {
  static initClass() {
    this.prototype.default_view = BoxAnnotationView;

    this.prototype.type = 'BoxAnnotation';

    this.mixins(['line', 'fill']);

    this.define({
        render_mode:  [ p.RenderMode,   'canvas'  ],
        x_range_name: [ p.String,       'default' ],
        y_range_name: [ p.String,       'default' ],
        top:          [ p.Number,       null      ],
        top_units:    [ p.SpatialUnits, 'data'    ],
        bottom:       [ p.Number,       null      ],
        bottom_units: [ p.SpatialUnits, 'data'    ],
        left:         [ p.Number,       null      ],
        left_units:   [ p.SpatialUnits, 'data'    ],
        right:        [ p.Number,       null      ],
        right_units:  [ p.SpatialUnits, 'data'    ]
    });

    this.internal({
      screen: [ p.Boolean, false ]
    });

    this.override({
      fill_color: '#fff9ba',
      fill_alpha: 0.4,
      line_color: '#cccccc',
      line_alpha: 0.3
    });
  }

  initialize(attrs: any, options: any): void {
    super.initialize(attrs, options);
    this.data_update = new Signal(this, "data_update");
  }

  update({left, right, top, bottom}) {
    this.setv({left, right, top, bottom, screen: true}, {silent: true});
    this.data_update.emit();
  }
}
BoxAnnotation.initClass();
