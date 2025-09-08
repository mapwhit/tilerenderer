export default String.raw`uniform vec2 u_texsize;uniform float u_fade;uniform mediump vec4 u_scale;uniform sampler2D u_image;varying vec2 v_normal;varying vec2 v_width2;varying float v_linesofar;varying float v_gamma_scale;
#pragma mapbox: define lowp vec4 pattern_from
#pragma mapbox: define lowp vec4 pattern_to
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
void main(){
#pragma mapbox: initialize mediump vec4 pattern_from
#pragma mapbox: initialize mediump vec4 pattern_to
#pragma mapbox: initialize lowp float blur
#pragma mapbox: initialize lowp float opacity
vec2 pattern_tl_a=pattern_from.xy;vec2 pattern_br_a=pattern_from.zw;vec2 pattern_tl_b=pattern_to.xy;vec2 pattern_br_b=pattern_to.zw;float pixelRatio=u_scale.x;float tileZoomRatio=u_scale.y;float fromScale=u_scale.z;float toScale=u_scale.w;vec2 display_size_a=vec2((pattern_br_a.x-pattern_tl_a.x)/pixelRatio,(pattern_br_a.y-pattern_tl_a.y)/pixelRatio);vec2 display_size_b=vec2((pattern_br_b.x-pattern_tl_b.x)/pixelRatio,(pattern_br_b.y-pattern_tl_b.y)/pixelRatio);vec2 pattern_size_a=vec2(display_size_a.x*fromScale/tileZoomRatio,display_size_a.y);vec2 pattern_size_b=vec2(display_size_b.x*toScale/tileZoomRatio,display_size_b.y);float dist=length(v_normal)*v_width2.s;float blur2=(blur+1./DEVICE_PIXEL_RATIO)*v_gamma_scale;float alpha=clamp(min(dist-(v_width2.t-blur2),v_width2.s-dist)/blur2,0.,1.);float x_a=mod(v_linesofar/pattern_size_a.x,1.);float x_b=mod(v_linesofar/pattern_size_b.x,1.);float y_a=0.5+(v_normal.y*clamp(v_width2.s,0.,(pattern_size_a.y+2.)/2.)/pattern_size_a.y);float y_b=0.5+(v_normal.y*clamp(v_width2.s,0.,(pattern_size_b.y+2.)/2.)/pattern_size_b.y);vec2 pos_a=mix(pattern_tl_a/u_texsize,pattern_br_a/u_texsize,vec2(x_a,y_a));vec2 pos_b=mix(pattern_tl_b/u_texsize,pattern_br_b/u_texsize,vec2(x_b,y_b));vec4 color=mix(texture2D(u_image,pos_a),texture2D(u_image,pos_b),u_fade);gl_FragColor=color*alpha*opacity;
#ifdef OVERDRAW_INSPECTOR
gl_FragColor=vec4(1.);
#endif
}`