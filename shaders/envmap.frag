

  precision highp float;

#define PI 3.14159265359
#define INVPI 0.31830988618

uniform sampler2D Texture0;
uniform float Exposure;
uniform float Gamma;

varying vec3 osg_FragNormal;
varying vec3 osg_FragEye;
varying vec3 osg_FragVertex;
varying vec2 osg_TexCoord0;

////////////////////////////////////////////////////////////////////////
// -------------------------- LinearSpace ------------------------------
////////////////////////////////////////////////////////////////////////

vec3 pow_vec3_f(vec3 v, float p)
{
    return pow(v, vec3(p));
}
// http://filmicgames.com/archives/14
float LinearToSrgb(float val)
{
   float ret;
   if (val <= 0.0)
      ret = 0.0;
   else if (val <= 0.0031308)
      ret = 12.92*val;
   else if (val <= 1.0)
      ret = (pow(val, 0.41666)*1.055)-0.055;
   else
      ret = 1.0;
   return ret;
}

float SrgbToLinear(float val)
{
   float ret;
   if (val <= 0.0)
      ret = 0.0;
   else if (val <= 0.04045)
      ret = val / 12.92;
   else if (val <= 1.0)
      ret = pow((val + 0.055)/1.055,2.4);
   else
      ret = 1.0;
   return ret;
}

vec3 ToLinear(vec3 v, float gamma) {
    if (gamma == 2.2)
        return vec3(SrgbToLinear(v.x), SrgbToLinear(v.y), SrgbToLinear(v.z));
    else if (gamma == 2.0)
        return v * v;
    else
        return pow_vec3_f(v, gamma);
}
vec3 ToSRGB(vec3 v, float gamma)   {
    if (gamma == 2.2)
        return vec3(LinearToSrgb(v.x), LinearToSrgb(v.y), LinearToSrgb(v.z));
    else if (gamma == 2.0)
        return sqrt(v);
    else
        return pow_vec3_f(v, 1.0/gamma);
}

////////////////////////////////////////////////////////////////////
// convert 8-bit RGB channels into floats using the common E exponent
////////////////////////////////////////////////////////////////////
vec3 decodeRGBE(vec4 rgbe) {
    float f = pow(2.0, rgbe.w * 255.0 - (128.0 + 8.0));
    return rgbe.rgb * 255.0 * f;
}
////////////////////////////////////////////////////////////////////
// fetch from environment sphere texture
////////////////////////////////////////////////////////////////////
vec4 textureSphere(sampler2D tex, vec3 r) {

 #define OPT_SPHERE_SAMPLE_GET 1
#ifdef OPT_SPHERE_SAMPLE_GET
    /*vec2 vN;
     vN.y = -r.y;
     float m = PI * 0.8  * sqrt((r.x) * (r.x) + (r.y) * (r.y) + (r.z ) * (r.z ));
      vN.x = r.z / m ;
      vN = vN * vec2(0.5) + vec2(0.5);
      return texture2D(tex, vN);*/
    vec2 vN;
    vN.y = -r.y;
    vN.x = atan( r.z,  r.x ) * INVPI;
    vN = vN * vec2(0.5) + vec2(0.5);
    return texture2D(tex, vN);
#else
    float yaw = acos(r.y) / PI;
    float pitch = (atan(r.x, r.z) + PI) / (2.0 * PI);
    vec2 vN = vec2(pitch, yaw);
    return texture2D(tex, vN);
#endif

}
////////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////////
void main(void) {
    vec3 normal = normalize(osg_FragVertex.xyz);
    vec3 c = ToSRGB(decodeRGBE(textureSphere(Texture0, normal)).rgb, Gamma);
    gl_FragColor = vec4(Exposure + c, 1.0);
}
