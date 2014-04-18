#define PI    3.14159265359
#define INVPI 0.31830988618

////////////  http://www.alexandre-pestana.com/tweaking-the-cook-torrance-brdf/
////////////  http://graphicrants.blogspot.ca/2013/08/specular-brdf-reference.html
///////////// http://www.thetenthplanet.de/archives/255

////////////////////////////////////////////////////////////////////////
// -------------------------- Helper functions--------------------------
////////////////////////////////////////////////////////////////////////

float saturate(float v)
{
    return clamp(v, 0.0, 1.0);
}
vec3 pow_vec3_f(vec3 v, float p)
{
    return pow(v, vec3(p));
}


////////////////////////////////////////////////////////////////////////
// -------------------------- LinearSpace ------------------------------
////////////////////////////////////////////////////////////////////////
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
        return v*v;
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


/////////////////////////////////////////////////////////////////////////
//-------------------------- Normal distribution functions --------------
/////////////////////////////////////////////////////////////////////////

float NormalDistribution_GGX(float alpha, float NdH)
{
    // Isotropic ggx.
    float rSq = alpha * alpha;
    float NdH2 = NdH * NdH;
    float denominator = NdH2 * (rSq - 1.0) + 1.0;
    denominator *= denominator;
    denominator *= PI;

    return rSq / denominator;
}

float NormalDistribution_BlinnPhong(float alpha, float NdH)
{

    float rSq = alpha * alpha;
    float m = (2.0 / rSq) - 2.0;
    //return (m+2.0) * pow( NdH, m) / (2.0 * PI);
    return pow(NdH, m) / (PI * rSq);
}

float NormalDistribution_Beckmann(float alpha, float NdH)
{
    float m_Sq = alpha * alpha;
    float NdH_Sq = NdH * NdH;
    return exp( (NdH_Sq - 1.0)/(m_Sq * NdH_Sq) ) / (PI * m_Sq * NdH_Sq * NdH_Sq + 0.0001) ;
}

// DISTRIBUTION USAGE
/////////////////////////
float Specular_D(vec3 n, float a, float NdH)
{
#if defined(NDF_BLINNPHONG)
    return NormalDistribution_BlinnPhong(a, NdH);
#elif defined(NDF_BLINNPHONG)
    return NormalDistribution_Beckmann(a, NdH);
#elif defined(NDF_GGX)
    return NormalDistribution_GGX(a, NdH);
#else
    return 1.0;
#endif
}

/////////////////////////////////////////////////////////////////////////
//-------------------------- Geometry shadowing ------------------------
/////////////////////////////////////////////////////////////////////////
float Geometry_Implicit(float alpha, float NdV, float NdL)
{
    return NdL * NdV;
}

float Geometry_Neumann(float alpha, float NdV, float NdL)
{
    return (NdL * NdV) / max(NdL, NdV);
}

float Geometry_CookTorrance(float alpha, float NdV, float NdL, float NdH, float VdH)
{
    float numer = ( 2.0 * NdH ) / VdH ;
    return min(1.0, min(numer * NdV, numer * NdL));
}

float Geometry_Kelemen(float alpha, float NdV, float NdL, float LdV)
{
    return (2.0 * NdL * NdV) / (1.0 + LdV);
}

float Geometry_Beckman(float rSq, float dotValue)
{
    float c = dotValue / ( rSq * sqrt(1.0 - dotValue * dotValue));

    if ( c >= 1.6 )
    {
        return 1.0;
    }
    else
    {
        float c2 = c * c;
        return (3.535 * c + 2.181 * c2) / ( 1.0 + 2.276 * c + 2.577 * c2);
    }
}

float Geometry_Smith_Beckmann(float alpha, float NdV, float NdL)
{
    return Geometry_Beckman(alpha, NdV) * Geometry_Beckman(alpha, NdL);
}

float Geometry_GGX(float aSq, float dotValue)
{
    return (2.0 * dotValue) / (dotValue + sqrt(aSq + ((1.0 - aSq) * (dotValue * dotValue))));
}

float Geometry_Smith_GGX(float alpha, float NdV, float NdL)
{
    float aSq = alpha * alpha;
    return Geometry_GGX(aSq, NdV) * Geometry_GGX(aSq, NdL);
}

float Geometry_Smith_Schlick_GGX(float alpha, float NdV, float NdL)
{
    float k = alpha * 0.5;
    float one_minus_k = 1.0 -k;
    float GV = NdV / (NdV * one_minus_k + k);
    float GL = NdL / (NdL * one_minus_k + k);
    return GV * GL;
}

float Geometry_Schlick(float alpha, float NdV, float NdL){
    float k = alpha * sqrt(2.0/PI);
    float one_minus_k = 1.0 -k;
    float GV = NdV / (NdV * one_minus_k + k);
    float GL = NdL / (NdL * one_minus_k + k);
    return GV + GL;
}

float Geometry_Walter(float alpha, float NdV, float NdL, float NdH, float VdH, float HdL){
    float a = 1.0 / ( alpha * tan( acos(NdV) ) );
    float a_Sq = a * a;
    float a_term;
    if (a < 1.6)
        a_term= (3.535 * a + 2.181 * a_Sq)/(1.0 + 2.276 * a + 2.577 * a_Sq);
    else
        a_term= 1.0;

   return  ( step(0.0, HdL/NdL) * a_term  ) *
        ( step(0.0, VdH/NdV) * a_term  ) ;
}

// GEOMETRY TERM
////////////////////
float Specular_G(float alpha, float NdV, float NdL, float NdH, float VdH, float HdL, float LdV)
{

#if defined(GEOMETRY_IMPLICIT)
    return Geometry_Implicit(alpha, NdV, NdL);
#elif defined(GEOMETRY_NEUMANN)
    return Geometry_Neumann(alpha, NdV, NdL);
#elif defined(GEOMETRY_WALTER)
    return Geometry_Walter(alpha, NdV, NdL, NdH, VdH, HdL);
#elif defined(GEOMETRY_COOKTORRANCE)
    return Geometry_CookTorrance(alpha, NdV, NdL, NdH, VdH);
#elif defined(GEOMETRY_KELEMEN)
    return Geometry_Kelemen(alpha, NdV, NdL, LdV);
#elif defined(GEOMETRY_SMITH_BECKMANN)
    return Geometry_Smith_Beckmann(alpha, NdV, NdL);
#elif defined(GEOMETRY_SMITH_GGX)
    return Geometry_Smith_GGX(alpha, NdV, NdL);
#elif defined(GEOMETRY_SMITH_SCHLICK_GGX)
    return Geometry_Smith_Schlick_GGX(alpha, NdV, NdL);
#elif defined(GEOMETRY_SCHLICK)
    return Geometry_Schlick(alpha, NdV, NdL);
#endif
}

/////////////////////////////////////////////////////////////////////////
//-------------------------- Fresnel ------------------------------------
/////////////////////////////////////////////////////////////////////////
vec3 Fresnel_None(vec3 specularColor)
{
    return specularColor;
}

vec3 Fresnel_Schlick(vec3 specularColor, vec3 h, vec3 v)
{
    return (specularColor + (1.0 - specularColor) * pow((1.0 - max(0.0, dot(v, h))), 5.0));
}

vec3 Fresnel_CookTorrance(vec3 specularColor, vec3 h, vec3 v)
{
    vec3 sqrtSpec = sqrt(specularColor);
    vec3 n = (1.0 + sqrtSpec) / (1.0 - sqrtSpec);
    float c = max(dot(v, h), 0.0);
    vec3 g = sqrt(n * n + c * c - 1.0);

    vec3 part1 = (g - c)/(g + c);
    vec3 part2 = ((g + c) * c - 1.0)/((g - c) * c + 1.0);

    return max(vec3(0.0), 0.5 * part1 * part1 * ( 1.0 + part2 * part2));
}

// FRESNEL
/////////////////////////
vec3 Specular_F(vec3 specularColor, vec3 h, vec3 v)
{
#if defined(FRESNEL_SCHLICK)
    return Fresnel_Schlick(specularColor, h, v);
#elif defined(FRESNEL_COOKTORRANCE)
    return Fresnel_CookTorrance(specularColor, h, v);
#else // FRESNSEL_NONE
    return Fresnel_None(specularColor);
#endif
}

// ROUGHNESS
/////////////////////////
vec3 Specular_F_Roughness(vec3 specularColor, float alpha, vec3 h, vec3 v)
{
#if defined(FRESNEL_SCHLICK)
    // Sclick using roughness to attenuate fresnel.
    return (specularColor + (max(vec3(1.0-alpha), specularColor) - specularColor) * pow(1.0 - max(dot(v, h),0.0), 5.0));
#elif defined(FRESNEL_COOKTORRANCE)
    return Fresnel_CookTorrance(specularColor, h, v);
#else //FRESNEL_NONE
    return Fresnel_None(specularColor);
#endif
}


/////////////////////////////////////////////////////////////////////////
//-------------------------- Diffuse Energy Conservation ----------------
/////////////////////////////////////////////////////////////////////////

vec3 ComputeDiffuseEnergyConservation(vec3 specularColor, vec3 fresnelSpec)
{
#if defined(EnergyRatio_FresnelDiff)
    return vec3(1.0 - fresnelSpec);
#elif defined(EnergyRatio_FresnelSpec)
    return (vec3(1.0) - specularColor);
#elif defined(EnergyRatio_PI)
    return vec3(1.0 / PI);
#else
    return vec3(1.0);
#endif
}

/////////////////////////////////////////////////////////////////////////
//-------------------------- LIGHT EQUATION -----------------------------
/////////////////////////////////////////////////////////////////////////


vec3 ComputeLight(vec3 albedoColor,vec3 specularColor, vec3 normal, float roughness, vec3 lightPosition, vec3 lightColor, vec3 lightDir, vec3 viewDir)
{
    // Compute some useful values.
    float NdL = max(dot(normal, lightDir), 0.0);
    float NdV = max(dot(normal, viewDir), 0.0);
    vec3 h = normalize(lightDir + viewDir);
    float NdH = max(dot(normal, h), 0.0);
    float VdH = max(dot(viewDir, h), 0.0);
    float HdL = max(dot(h, lightDir), 0.0);
    float LdV = max(dot(lightDir, viewDir), 0.0);
    float a = max(0.0001, roughness * roughness);

    float spec = Specular_D(normal, a, NdH);
    spec *= Specular_G(a, NdV, NdL, NdH, VdH, HdL, LdV);
    spec /= (4.0 * NdL * NdV + 0.0001);
    vec3 fresnelSpec = Specular_F(specularColor, viewDir, h);

    vec3 cSpec = spec * fresnelSpec;
    vec3 cDiff = albedoColor * ComputeDiffuseEnergyConservation (specularColor, cSpec);

    return lightColor * NdL * (cDiff + cSpec);
}

/////////////////////////////////////////////////////////////////////////
//-------------------------- NORMAL MAP (toksvig, derivatives, aa, etc)-----------
/////////////////////////////////////////////////////////////////////////

// Compute the "Toksvig Factor"
// http://blog.selfshadow.com/2011/07/22/specular-showdown/
float Gloss(vec3 bump, float power)
{
    float gloss = 1.0;
    // Compute the "Toksvig Factor"
    float rlen = 1.0 / saturate(length(bump));
    gloss = 1.0 / (1.0 + power * (rlen - 1.0));
    return gloss;
}

#ifdef GL_OES_standard_derivativesd

#extension GL_OES_standard_derivatives : enable
// better, faster, stronger
// http://www.thetenthplanet.de/archives/1180#more-1180
mat3 cotangent_frame( vec3 N, vec3 p, vec2 uv )
{
    // get edge vectors of the pixel triangle
    vec3 dp1 = dFdx( p );
    vec3 dp2 = dFdy( p );
    vec2 duv1 = dFdx( uv );
    vec2 duv2 = dFdy( uv );

    // solve the linear system
    vec3 dp2perp = cross( dp2, N );
    vec3 dp1perp = cross( N, dp1 );
    vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

    // construct a scale-invariant frame
    float invmax = inversesqrt( max( dot(T,T), dot(B,B) ) );
    return mat3( T * invmax, B * invmax, N );
}


vec3 perturb_normal( vec3 N, vec3 map, vec3 V, vec2 texcoord )
{
    // setup GUI
    // assume N, the interpolated vertex normal and
    // V, the view vector (vertex to eye)
#ifdef WITH_NORMALMAP_UNSIGNED
    map = map * 255./127. - 128./127.;
#endif
#ifdef WITH_NORMALMAP_2CHANNEL
    map.z = sqrt( 1. - dot( map.xy, map.xy ) );
#endif
#ifdef WITH_NORMALMAP_GREEN_UP
    map.y = -map.y;
#endif
    mat3 TBN = cotangent_frame( N, -V, texcoord );
    return normalize( TBN * map );
}

#else

vec3 perturb_normal( vec3 N, vec3 T,  vec3 map, vec3 V, vec2 texcoord )
{
    // setup GUI
    // assume N, the interpolated vertex normal and
    // V, the view vector (vertex to eye)
#ifdef WITH_NORMALMAP_UNSIGNED
    map = map * 255./127. - 128./127.;
#endif
#ifdef WITH_NORMALMAP_2CHANNEL
    map.z = sqrt( 1. - dot( map.xy, map.xy ) );
#endif
#ifdef WITH_NORMALMAP_GREEN_UP
    map.y = -map.y;
#endif

    // Transform normal to world-space
    vec3 wbitangent = cross(N, T);
    mat3 t2w = mat3(T, wbitangent, N);
    vec3 n = normalize(t2w*map);
    return n;
}

#endif

////////////////////////////////////////////////////////////////////////
//--------------------------ENV MAP-------------------------------------
////////////////////////////////////////////////////////////////////////

vec3 cubemapReflectionVector(const in mat4 transform, const in vec3 view, const in vec3 normal)
{
    vec3 lv = reflect(view, normal);
    lv = normalize(lv);
    vec3 x = vec3(transform[0][0], transform[1][0], transform[2][0]);
    vec3 y = vec3(transform[0][1], transform[1][1], transform[2][1]);
    vec3 z = vec3(transform[0][2], transform[1][2], transform[2][2]);
    mat3 m = mat3(x,y,z);
    return m*lv;
}

// convert 8-bit RGB channels into floats using the common E exponent
vec3 decodeRGBE(vec4 rgbe) {
    float f = pow(2.0, rgbe.w * 255.0 - (128.0 + 8.0));
    return rgbe.rgb * 255.0 * f;
}

// fetch from environment sphere texture
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

/////////////////////////////////////////////////////////////////////////
//-------------------------- MAIN SHADER PART ---------------------------
/////////////////////////////////////////////////////////////////////////

uniform mat4 ModelViewMatrix;
uniform mat4 ProjectionMatrix;
uniform mat4 NormalMatrix;

#ifdef USE_DIFFUSE_MAP
uniform sampler2D Texture0;
#endif

#ifdef USE_ROUGHNESS_MAP
uniform sampler2D Texture1;
#endif

#ifdef USE_METALLIC_MAP
uniform sampler2D Texture2;
#endif

#ifdef USE_NORMAL_MAP
uniform sampler2D Texture3;
#endif

#ifdef USE_ENV_MAP
uniform sampler2D Texture4;
uniform sampler2D Texture5;
#endif


varying vec4 position;
varying vec4 normal;
varying vec4 tangent;
varying vec2 texcoord0;

uniform vec4 lightPos;
uniform vec4 eyePos;

uniform vec4 Albedo;
uniform vec4 Specular;

uniform float Metallic;
uniform float Roughness;

uniform float LightIntensity;
uniform float Gamma;
uniform float Exposure;
uniform vec4 LightColor;
uniform mat4 CubemapTransform;


void main(void)
{

#ifdef USE_DIFFUSE_MAP
    vec3 albedoColor = ToLinear(texture2D(Texture0, texcoord0).rgb, Gamma);
#else
    vec3 albedoColor = Albedo.xyz;
#endif


#ifdef USE_ROUGHNESS_MAP
    float roughness = texture2D(Texture1, texcoord0).r;
#else
    float roughness = Roughness;
#endif

#ifdef USE_GLOSSINESS
    roughness = 1.0 - roughness;
#endif



#ifdef METALLIC

#ifdef USE_METALLIC_MAP
    float metallic = texture2D(Texture2, texcoord0).r;
#else
    float metallic = Metallic;
#endif

#elif SPECULAR
    vec3 specularColor = Specular.xyz;
#endif

  vec4 lightPosition = lightPos;
  vec3 lightColor = LightColor.xyz;
  float lightIntensity = LightIntensity;

    // Compute view direction.
    vec4 pos = position / position.w;
    vec3 viewDir = normalize(eyePos.xyz - pos.xyz);
    vec3 lightDist = lightPos.xyz - pos.xyz;
    vec3 lightDir = normalize(lightDist);

#ifdef USE_NORMAL_MAP
    #ifdef GL_OES_standard_derivativesd
          vec3 normalN = perturb_normal( normal.xyz, texture2D(Texture3, texcoord0.xy).xyz, viewDir, texcoord0.xy );
    #else
          vec3 normalN = perturb_normal( normal.xyz, tangent.xyz, texture2D(Texture3, texcoord0.xy).xyz, -viewDir, texcoord0.xy );
    #endif

    #ifdef USE_TOKSVIG
          // mipmap normal map
          roughness = Gloss(normalN, roughness);
    #endif

#else
    vec3 normalN = normalize(normal.xyz);
#endif


#ifdef METALLIC
    // Lerp with metallic value to find the good diffuse and specular.
    vec3 realAlbedo = albedoColor - albedoColor * metallic;

    // 0.03 default specular value for dielectric.
    vec3 realSpecularColor = mix(vec3(0.03), albedoColor, metallic);
#elif SPECULAR

    vec3 realAlbedo = albedoColor;
    vec3 realSpecularColor = specularColor;

#endif // METALLIC

    vec3 light1 = ComputeLight( realAlbedo.xyz, realSpecularColor.xyz,  normalN.xyz,  roughness,  lightPos.xyz, lightColor.xyz, lightDir.xyz, viewDir.xyz);

    float lightDistLength = length(lightDist);
    lightDistLength *= lightDistLength;
    float attenuation =  PI / lightDistLength;
    light1 = attenuation * light1 ;

#ifdef USE_ENV_MAP
    vec3 irradiance = decodeRGBE(textureSphere(Texture5, normalN));

    vec3 reflectVector = cubemapReflectionVector(CubemapTransform, -viewDir, normalN);
    //float mipIndex =  roughness * roughness * 8.0f; // missing http://www.khronos.org/registry/webgl/extensions/EXT_shader_texture_lod/
    vec3 envColor = decodeRGBE(textureSphere(Texture4, reflectVector ));
    vec3 envFresnel = Specular_F_Roughness(realSpecularColor, roughness * roughness, normalN, viewDir);
    vec3 envContrib = envFresnel * envColor;
#else
    vec3 envContrib = vec3(0.0);
    vec3 irradiance = vec3(0.0);
#endif

    gl_FragColor = vec4(ToSRGB(Exposure + (light1 + realAlbedo*irradiance + envContrib), Gamma), 1.0);

}
