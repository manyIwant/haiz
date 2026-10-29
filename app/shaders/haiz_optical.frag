#version 460 core
#include <flutter/runtime_effect.glsl>

// Native port of haiz.space/assets/js/optical-glass.js.
// Live backdrop refraction with rounded-distance bevel and RGB dispersion.
uniform vec2 u_size;
uniform sampler2D u_texture;
out vec4 fragColor;

float sdRound(vec2 p, vec2 b, float r) {
  vec2 q = abs(p)-b+r;
  return length(max(q,vec2(0.))) + min(max(q.x,q.y),0.) - r;
}

vec3 backgroundAt(vec2 uv) {
  uv=clamp(uv,vec2(.002),vec2(.998));
#ifdef IMPELLER_TARGET_OPENGLES
  uv.y=1.-uv.y;
#endif
  return texture(u_texture,uv).rgb;
}

vec3 transmitted(vec2 uv,vec2 offset) {
  return vec3(backgroundAt(uv+offset*1.024).r,
              backgroundAt(uv+offset).g,
              backgroundAt(uv+offset*.976).b);
}

void main() {
  vec2 size=max(u_size,vec2(1.));
  vec2 p=FlutterFragCoord().xy, halfSize=size*.5, local=p-halfSize;
  float r=min(26.,min(halfSize.x,halfSize.y));
  float d=sdRound(local,halfSize,r);
  float edge=clamp(1.+d/min(18.,r*.7),0.,1.);
  float e=.45;
  vec2 grad=vec2(
    sdRound(local+vec2(e,0.),halfSize,r)-sdRound(local-vec2(e,0.),halfSize,r),
    sdRound(local+vec2(0.,e),halfSize,r)-sdRound(local-vec2(0.,e),halfSize,r));
  grad=normalize(grad+vec2(.000001));
  float angle=edge*1.12;
  vec3 normal=vec3(grad*sin(angle),cos(angle));
  vec3 ray=refract(vec3(0.,0.,-1.),normal,1./1.46);
  vec2 offset=ray.xy/max(.2,abs(ray.z))*18./size;
  vec2 uv=(p/size-.5)*.997+.5, blur=vec2(1.25)/size;
  vec3 glass=(transmitted(uv,offset)*4.
    +transmitted(uv+blur,offset)+transmitted(uv-blur,offset)
    +transmitted(uv+vec2(blur.x,-blur.y),offset)
    +transmitted(uv+vec2(-blur.x,blur.y),offset))/8.;
  float lum=dot(glass,vec3(.2126,.7152,.0722));
  glass=mix(vec3(lum),glass,.76);
  glass=mix(glass,vec3(.95,.97,.94),.30);
  vec3 light=normalize(vec3(-.65,.8,.65));
  float spec=pow(max(0.,dot(reflect(-light,normal),vec3(0.,0.,1.))),44.);
  float fresnel=.035+.965*pow(1.-normal.z,5.);
  float rim=exp(-abs(d+1.)*1.4);
  float rimLight=.35+.65*max(0.,dot(grad,normalize(vec2(-.65,.8))));
  glass+=vec3(.98,1.,.98)*(spec*.34+fresnel*.22+rim*rimLight*.48);
  glass-=vec3(.12,.15,.13)*exp(-abs(d+3.)*1.1)*.2;
  fragColor=vec4(clamp(glass,0.,1.),1.);
}
