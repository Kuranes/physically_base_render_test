#define PI 3.14159265359


////////////http://www.alexandre-pestana.com/tweaking-the-cook-torrance-brdf/
////////////http://graphicrants.blogspot.ca/2013/08/specular-brdf-reference.html
/////////////http://www.thetenthplanet.de/archives/255

////////////////////////////////////////////////////////////////////////
// -------------------------- Helper functions--------------------------
////////////////////////////////////////////////////////////////////////

float saturate(float v)
{
    return clamp(v, 0.0, 1.0);
}

vec3 pow_vec3(vec3 v, float p)
{
    return vec3(pow(v.x, p), pow(v.y, p), pow(v.z, p));
}

vec3 ToLinear(vec3 v, float gamma) { return pow_vec3(v,     gamma); }
vec3 ToSRGB(vec3 v, float gamma)   { return pow_vec3(v, 1.0/gamma); }

/////////////////////////////////////////////////////////////////////////
//-------------------------- Normal distribution functions --------------
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


float NormalDistribution_Toksvig_BlinnPhong(vec3 n, float a, float NdH)
{
   // Compute 'anti-aliasing' gloss map
    float gloss = Gloss(n, a);

    // Energy conserving Blinn-Phong
    a     = a * gloss;
    //float spec = pow(NdH, a)*(a + 2.0)/( 8.0 );
    //return  spec;
    float spec = pow(NdH, 2.0 / (a) - 2.0);
    return (1.0 / (PI * a)) * spec;
}


float NormalDistribution_GGX(float a, float NdH)
{
    // Isotropic ggx.
    float a2 = a*a;
    float NdH2 = NdH * NdH;
    float denominator = NdH2 * (a2 - 1.0) + 1.0;
    denominator *= denominator;
    denominator *= PI;

    return a2 / denominator;
}

float NormalDistribution_BlinnPhong(float a, float NdH)
{
    float a2 = a*a;
    return (1.0 / (PI * a2)) * pow(NdH, 2.0 / (a2) - 2.0);
}

float NormalDistribution_Beckmann(float a, float NdH)
{
    float a2 = a * a;
    float NdH2 = NdH * NdH;

    return (1.0/(PI * a2 * NdH2 * NdH2 + 0.001)) * exp( (NdH2 - 1.0) / ( a2 * NdH2));
}

// DISTRIBUTION USAGE
/////////////////////////
float Specular_D(vec3 n, float a, float NdH)
{

#ifdef NDF_BLINNPHONGTOKSVIG
    return NormalDistribution_Toksvig_BlinnPhong(n, a, NdH);
#else
#ifdef NDF_BLINNPHONG
    return NormalDistribution_BlinnPhong(a, NdH);
#else
#ifdef NDF_BECKMANN
    return NormalDistribution_Beckmann(a, NdH);
#else
#ifdef NDF_GGX
    return NormalDistribution_GGX(a, NdH);
#endif
#endif
#endif
#endif
}

/////////////////////////////////////////////////////////////////////////
//-------------------------- Geometric shadowing ------------------------
/////////////////////////////////////////////////////////////////////////
float Geometric_Implicit(float a, float NdV, float NdL)
{
    return NdL * NdV;
}

float Geometric_Neumann(float a, float NdV, float NdL)
{
    return (NdL * NdV) / max(NdL, NdV);
}

float Geometric_CookTorrance(float a, float NdV, float NdL, float NdH, float VdH)
{
    float numer = ( 2.0 * NdH ) / VdH ;
    return min(1.0, min(numer * NdV, numer * NdL));
}

float Geometric_Kelemen(float a, float NdV, float NdL, float LdV)
{
    return (2.0 * NdL * NdV) / (1.0 + LdV);
}

float Geometric_Beckman(float a, float dotValue)
{
    float c = dotValue / ( a * sqrt(1.0 - dotValue * dotValue));

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

float Geometric_Smith_Beckmann(float a, float NdV, float NdL)
{
    return Geometric_Beckman(a, NdV) * Geometric_Beckman(a, NdL);
}

float Geometric_GGX(float a2, float dotValue)
{
    return (2.0 * dotValue) / (dotValue + sqrt(a2 + ((1.0 - a2) * (dotValue * dotValue))));
}

float Geometric_Smith_GGX(float a, float NdV, float NdL)
{
    float a2 = a * a;
    return Geometric_GGX(a2, NdV) * Geometric_GGX(a2, NdL);
}

float Geometric_Smith_Schlick_GGX(float a, float NdV, float NdL)
{
    // Smith schlick-GGX.
    float k = a * 0.5;
    float GV = NdV / (NdV * (1.0 - k) + k);
    float GL = NdL / (NdL * (1.0 - k) + k);

    return GV * GL;
}

// GEOMETRIC TERM
////////////////////
float Specular_G(float a, float NdV, float NdL, float NdH, float VdH, float LdV)
{

#ifdef GEOMETRIC_IMPLICIT
    return Geometric_Implicit(a, NdV, NdL);
#else

#ifdef GEOMETRIC_NEUMANN
    return Geometric_Neumann(a, NdV, NdL);
#else

#ifdef GEOMETRIC_COOKTORRANCE
    return Geometric_CookTorrance(a, NdV, NdL, NdH, VdH);
#else

#ifdef GEOMETRIC_KELEMEN
    return Geometric_Kelemen(a, NdV, NdL, LdV);
#else

#ifdef GEOMETRIC_SMITH_BECKMANN
    return Geometric_Smith_Beckmann(a, NdV, NdL);
#else

#ifdef GEOMETRIC_SMITH_GGX
    return Geometric_Smith_GGX(a, NdV, NdL);
#else

#ifdef GEOMETRIC_SMITH_SCHLICK_GGX
    return Geometric_Smith_Schlick_GGX(a, NdV, NdL);
#endif
#endif
#endif
#endif
#endif
#endif
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
    return (specularColor + (1.0 - specularColor) * pow((1.0 - saturate(dot(v, h))), 5.0));
}

vec3 Fresnel_CookTorrance(vec3 specularColor, vec3 h, vec3 v)
{
    vec3 sqrtSpec = sqrt(specularColor);
    vec3 n = (1.0 + sqrtSpec) / (1.0 - sqrtSpec);
    float c = saturate(dot(v, h));
    vec3 g = sqrt(n * n + c * c - 1.0);

    vec3 part1 = (g - c)/(g + c);
    vec3 part2 = ((g + c) * c - 1.0)/((g - c) * c + 1.0);

    return max(vec3(0.0), 0.5 * part1 * part1 * ( 1.0 + part2 * part2));
}

// FRESNEL
/////////////////////////
vec3 Specular_F(vec3 specularColor, vec3 h, vec3 v)
{
#ifdef FRESNEL_NONE
    return Fresnel_None(specularColor);
#else
#ifdef FRESNEL_SCHLICK
    return Fresnel_Schlick(specularColor, h, v);
#else
#ifdef FRESNEL_COOKTORRANCE
    return Fresnel_CookTorrance(specularColor, h, v);
#endif
#endif
#endif
}

// ROUGHNESS
/////////////////////////
vec3 Specular_F_Roughness(vec3 specularColor, float a, vec3 h, vec3 v)
{
#ifdef FRESNEL_SCHLICK
    // Sclick using roughness to attenuate fresnel.
    return (specularColor + (max(vec3(1.0-a), specularColor) - specularColor) * pow((1.0 - saturate(dot(v, h))), 5.0));
#else
#ifdef FRESNEL_NONE
    return Fresnel_None(specularColor);
#else
#ifdef FRESNEL_COOKTORRANCE
    return Fresnel_CookTorrance(specularColor, h, v);
#endif
#endif
#endif
}




/////////////////////////////////////////////////////////////////////////
//-------------------------- LIGHT EQUATION -----------------------------
/////////////////////////////////////////////////////////////////////////


vec3 ComputeDiffuse(vec3 pAlbedo)
{
    return pAlbedo / PI;
}

 vec3 ComputeSpecular(vec3 specularColor, vec3 normal, vec3 h, vec3 v, vec3 l, float a, float NdL, float NdV, float NdH, float VdH, float LdV)
{
    return (Specular_D(normal, a, NdH) * Specular_G(a, NdV, NdL, NdH, VdH, LdV) * Specular_F(specularColor, v, h) ) / (4.0 * NdL * NdV + 0.0001);
}

vec3 ComputeLight(vec3 albedoColor,vec3 specularColor, vec3 normal, float roughness, vec3 lightPosition, vec3 lightColor, vec3 lightDir, vec3 viewDir)
{
    // Compute some useful values.
    float NdL = saturate(dot(normal, lightDir));
    float NdV = saturate(dot(normal, viewDir));
    vec3 h = normalize(lightDir + viewDir);
    float NdH = saturate(dot(normal, h));
    float VdH = saturate(dot(viewDir, h));
    float LdV = saturate(dot(lightDir, viewDir));
    float a = max(0.001, roughness * roughness);

    vec3 cDiff = ComputeDiffuse(albedoColor);
    vec3 cSpec = ComputeSpecular(specularColor, normal, h, viewDir, lightDir, a, NdL, NdV, NdH, VdH, LdV);

    return lightColor * NdL * (cDiff * (1.0 - cSpec) + cSpec);
}

/////////////////////////////////////////////////////////////////////////
//-------------------------- NORMAL MAP (derivatives, aa, etc)-----------
/////////////////////////////////////////////////////////////////////////

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

#define WITH_NORMALMAP_UNSIGNED 1

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

#define WITH_NORMALMAP_UNSIGNED 1

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

// apply some gamma correction (http://www.geeks3d.com/20101001/tutorial-gamma-correction-a-story-of-linearity/)
vec3 toneMapHDR(vec3 rgb, float exposure, float gamma) {
    return pow(rgb * exposure, 1.0 / vec3(gamma));
}

// fetch from environment sphere texture
vec4 textureSphere(sampler2D tex, vec3 n) {
    float yaw = acos(n.y) / PI;
    float pitch = (atan(n.x, n.z) + PI) / (2.0 * PI);
    return texture2D(tex, vec2(pitch, yaw));
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
    //lightDistLength *= lightDistLength;
    float attenuation = lightIntensity + PI / lightDistLength;
    light1 = attenuation * light1 ;

#ifdef USE_ENV_MAP
    vec3 reflectVector = cubemapReflectionVector(CubemapTransform, -viewDir, normalN);
    //float mipIndex =  roughness * roughness * 8.0f; // missing http://www.khronos.org/registry/webgl/extensions/EXT_shader_texture_lod/
    vec3 envColor = toneMapHDR(decodeRGBE(textureSphere(Texture4, reflectVector)), Exposure, Gamma);
    vec3 irradiance = toneMapHDR(decodeRGBE(textureSphere(Texture5, normalN)), Exposure, Gamma);
    vec3 envFresnel = Specular_F_Roughness(realSpecularColor, roughness * roughness, normalN, viewDir);
    vec3 envContrib = envFresnel * envColor;
#else
    vec3 envContrib = vec3(0.0);
#endif

    gl_FragColor = vec4(ToSRGB(light1  + envContrib + realAlbedo, Gamma), 1.0);

}
