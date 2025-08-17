export default String.raw`#define scale  0.015873016
#define LINE_DISTANCE_SCALE  2.0
#define ANTIALIASING  1.0 / DEVICE_PIXEL_RATIO / 2.0
attribute vec4 a_pos_normal;attribute vec4 a_data;uniform mat4 u_matrix;uniform vec2 u_gl_units_to_pixels;uniform mediump float u_ratio;varying vec2 v_normal;varying vec2 v_width2;varying float v_linesofar;varying float v_gamma_scale;
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float offset
#pragma mapbox: define mediump float gapwidth
#pragma mapbox: define mediump float width
#pragma mapbox: define lowp vec4 pattern_from
#pragma mapbox: define lowp vec4 pattern_to
void main(){
#pragma mapbox: initialize lowp float blur
#pragma mapbox: initialize lowp float opacity
#pragma mapbox: initialize lowp float offset
#pragma mapbox: initialize mediump float gapwidth
#pragma mapbox: initialize mediump float width
#pragma mapbox: initialize mediump vec4 pattern_from
#pragma mapbox: initialize mediump vec4 pattern_to
vec2 a_extrude=a_data.xy-128.;float a_direction=mod(a_data.z,4.)-1.;float a_linesofar=(floor(a_data.z/4.)+a_data.w*64.)*LINE_DISTANCE_SCALE;vec2 pos=a_pos_normal.xy;mediump vec2 normal=a_pos_normal.zw;v_normal=normal;gapwidth=gapwidth/2.;float halfwidth=width/2.;offset=-1.*offset;float inset=gapwidth+(gapwidth>0.?ANTIALIASING:0.);float outset=gapwidth+halfwidth*(gapwidth>0.?2.:1.)+(halfwidth==0.?0.:ANTIALIASING);mediump vec2 dist=outset*a_extrude*scale;mediump float u=0.5*a_direction;mediump float t=1.-abs(u);mediump vec2 offset2=offset*a_extrude*scale*normal.y*mat2(t,-u,u,t);vec4 projected_extrude=u_matrix*vec4(dist/u_ratio,0.,0.);gl_Position=u_matrix*vec4(pos+offset2/u_ratio,0.,1.)+projected_extrude;float extrude_length_without_perspective=length(dist);float extrude_length_with_perspective=length(projected_extrude.xy/gl_Position.w*u_gl_units_to_pixels);v_gamma_scale=extrude_length_without_perspective/extrude_length_with_perspective;v_linesofar=a_linesofar;v_width2=vec2(outset,inset);}`