export default String.raw`#pragma mapbox: define highp float weight
#pragma mapbox: define mediump float radius
uniform mat4 u_matrix;uniform float u_extrude_scale;uniform float u_opacity;uniform float u_intensity;attribute vec2 a_pos;varying vec2 v_extrude;const highp float ZERO=1./255./16.;
#define GAUSS_COEF  0.3989422804014327
void main(void){
#pragma mapbox: initialize highp float weight
#pragma mapbox: initialize mediump float radius
vec2 unscaled_extrude=vec2(mod(a_pos,2.)*2.-1.);float S=sqrt(-2.*log(ZERO/weight/u_intensity/GAUSS_COEF))/3.;v_extrude=S*unscaled_extrude;vec2 extrude=v_extrude*radius*u_extrude_scale;vec4 pos=vec4(floor(a_pos*0.5)+extrude,0,1);gl_Position=u_matrix*pos;}`