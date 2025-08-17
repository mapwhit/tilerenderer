export default String.raw`uniform sampler2D u_image;varying vec2 v_pos;uniform vec2 u_latrange;uniform vec2 u_light;uniform vec4 u_shadow;uniform vec4 u_highlight;uniform vec4 u_accent;
#define PI  3.141592653589793
void main(){vec4 pixel=texture2D(u_image,v_pos);vec2 deriv=((pixel.rg*2.)-1.);float scaleFactor=cos(radians((u_latrange[0]-u_latrange[1])*(1.-v_pos.y)+u_latrange[1]));float slope=atan(1.25*length(deriv)/scaleFactor);float aspect=deriv.x!=0.?atan(deriv.y,-deriv.x):PI/2.*(deriv.y>0.?1.:-1.);float intensity=u_light.x;float azimuth=u_light.y+PI;float base=1.875-intensity*1.75;float maxValue=0.5*PI;float scaledSlope=intensity!=0.5?((pow(base,slope)-1.)/(pow(base,maxValue)-1.))*maxValue:slope;float accent=cos(scaledSlope);vec4 accent_color=(1.-accent)*u_accent*clamp(intensity*2.,0.,1.);float shade=abs(mod((aspect+azimuth)/PI+0.5,2.)-1.);vec4 shade_color=mix(u_shadow,u_highlight,shade)*sin(scaledSlope)*clamp(intensity*2.,0.,1.);gl_FragColor=accent_color*(1.-shade_color.a)+shade_color;
#ifdef OVERDRAW_INSPECTOR
gl_FragColor=vec4(1.);
#endif
}`