export default String.raw`#ifdef GL_ES
precision highp float;
#endif
uniform sampler2D u_image;varying vec2 v_pos;uniform vec2 u_dimension;uniform float u_zoom;uniform float u_maxzoom;float getElevation(vec2 coord,float bias){vec4 data=texture2D(u_image,coord)*255.;return(data.r+data.g*256.+data.b*256.*256.)/4.;}void main(){vec2 epsilon=1./u_dimension;float a=getElevation(v_pos+vec2(-epsilon.x,-epsilon.y),0.);float b=getElevation(v_pos+vec2(0,-epsilon.y),0.);float c=getElevation(v_pos+vec2(epsilon.x,-epsilon.y),0.);float d=getElevation(v_pos+vec2(-epsilon.x,0),0.);float e=getElevation(v_pos,0.);float f=getElevation(v_pos+vec2(epsilon.x,0),0.);float g=getElevation(v_pos+vec2(-epsilon.x,epsilon.y),0.);float h=getElevation(v_pos+vec2(0,epsilon.y),0.);float i=getElevation(v_pos+vec2(epsilon.x,epsilon.y),0.);float exaggeration=u_zoom<2.?0.4:u_zoom<4.5?0.35:0.3;vec2 deriv=vec2((c+f+f+i)-(a+d+d+g),(g+h+h+i)-(a+b+b+c))/pow(2.,(u_zoom-u_maxzoom)*exaggeration+19.2562-u_zoom);gl_FragColor=clamp(vec4(deriv.x/2.+0.5,deriv.y/2.+0.5,1.,1.),0.,1.);
#ifdef OVERDRAW_INSPECTOR
gl_FragColor=vec4(1.);
#endif
}`