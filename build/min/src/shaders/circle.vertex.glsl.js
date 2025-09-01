export default String.raw`uniform mat4 u_matrix;uniform bool u_scale_with_map;uniform bool u_pitch_with_map;uniform vec2 u_extrude_scale;uniform highp float u_camera_to_center_distance;attribute vec2 a_pos;
#pragma mapbox: define highp vec4 color
#pragma mapbox: define mediump float radius
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity
#pragma mapbox: define highp vec4 stroke_color
#pragma mapbox: define mediump float stroke_width
#pragma mapbox: define lowp float stroke_opacity
varying vec3 v_data;void main(void){
#pragma mapbox: initialize highp vec4 color
#pragma mapbox: initialize mediump float radius
#pragma mapbox: initialize lowp float blur
#pragma mapbox: initialize lowp float opacity
#pragma mapbox: initialize highp vec4 stroke_color
#pragma mapbox: initialize mediump float stroke_width
#pragma mapbox: initialize lowp float stroke_opacity
vec2 extrude=vec2(mod(a_pos,2.)*2.-1.);vec2 circle_center=floor(a_pos*0.5);if(u_pitch_with_map){vec2 corner_position=circle_center;if(u_scale_with_map){corner_position+=extrude*(radius+stroke_width)*u_extrude_scale;}else{vec4 projected_center=u_matrix*vec4(circle_center,0,1);corner_position+=extrude*(radius+stroke_width)*u_extrude_scale*(projected_center.w/u_camera_to_center_distance);}gl_Position=u_matrix*vec4(corner_position,0,1);}else{gl_Position=u_matrix*vec4(circle_center,0,1);if(u_scale_with_map){gl_Position.xy+=extrude*(radius+stroke_width)*u_extrude_scale*u_camera_to_center_distance;}else{gl_Position.xy+=extrude*(radius+stroke_width)*u_extrude_scale*gl_Position.w;}}lowp float antialiasblur=1./DEVICE_PIXEL_RATIO/(radius+stroke_width);v_data=vec3(extrude.x,extrude.y,antialiasblur);}`