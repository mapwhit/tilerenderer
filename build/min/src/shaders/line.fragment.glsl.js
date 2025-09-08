export default String.raw`#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
varying vec2 v_width2;varying vec2 v_normal;varying float v_gamma_scale;void main(){
#pragma mapbox: initialize highp vec4 color
#pragma mapbox: initialize lowp float blur
#pragma mapbox: initialize lowp float opacity
float dist=length(v_normal)*v_width2.s;float blur2=(blur+1./DEVICE_PIXEL_RATIO)*v_gamma_scale;float alpha=clamp(min(dist-(v_width2.t-blur2),v_width2.s-dist)/blur2,0.,1.);gl_FragColor=color*(alpha*opacity);
#ifdef OVERDRAW_INSPECTOR
gl_FragColor=vec4(1.);
#endif
}`