export default String.raw`uniform mat4 u_matrix;uniform vec3 u_lightcolor;uniform lowp vec3 u_lightpos;uniform lowp float u_lightintensity;uniform float u_vertical_gradient;uniform lowp float u_opacity;attribute vec2 a_pos;attribute vec4 a_normal_ed;varying vec4 v_color;
#pragma mapbox: define highp float base
#pragma mapbox: define highp float height
#pragma mapbox: define highp vec4 color
void main(){
#pragma mapbox: initialize highp float base
#pragma mapbox: initialize highp float height
#pragma mapbox: initialize highp vec4 color
vec3 normal=a_normal_ed.xyz;base=max(0.,base);height=max(0.,height);float t=mod(normal.x,2.);gl_Position=u_matrix*vec4(a_pos,t>0.?height:base,1);float colorvalue=color.r*0.2126+color.g*0.7152+color.b*0.0722;v_color=vec4(0.,0.,0.,1.);vec4 ambientlight=vec4(0.03,0.03,0.03,1.);color+=ambientlight;float directional=clamp(dot(normal/16384.,u_lightpos),0.,1.);directional=mix((1.-u_lightintensity),max((1.-colorvalue+u_lightintensity),1.),directional);if(normal.y!=0.){directional*=((1.-u_vertical_gradient)+(u_vertical_gradient*clamp((t+base)*pow(height/150.,0.5),mix(0.7,0.98,1.-u_lightintensity),1.)));}v_color.r+=clamp(color.r*directional*u_lightcolor.r,mix(0.,0.3,1.-u_lightcolor.r),1.);v_color.g+=clamp(color.g*directional*u_lightcolor.g,mix(0.,0.3,1.-u_lightcolor.g),1.);v_color.b+=clamp(color.b*directional*u_lightcolor.b,mix(0.,0.3,1.-u_lightcolor.b),1.);v_color*=u_opacity;}`