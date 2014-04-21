#define PI     3.14159265359
#define INVPI  0.31830988618
#define Pi2    6.283185307;
#define Pi_2   1.570796327;
#define Pi_4   0.7853981635;
#define InvPi2 0.159154943;

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

vec3 max_vec3_f(vec3 v, float p)
{
    return max(v, vec3(p));
}

float rcp(float x)
{
    return 1.0 / x;
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
#elif defined(NDF_BECKMANN)
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
    return (specularColor + (max(vec3(1.0-alpha), specularColor) - specularColor) * pow(1.0 - saturate(dot(v, h)), 5.0));
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
//-------------------------- LIGHT EQUATION EDUCATIONNAL-----------------
/////////////////////////////////////////////////////////////////////////


vec3  ComputeLightDiffuse(vec3 albedoColor,vec3 specularColor, vec3 cSpec)
{
    return albedoColor * ComputeDiffuseEnergyConservation (specularColor, cSpec);

}
vec3 ComputeLight(vec3 albedoColor,vec3 specularColor, vec3 normal, float roughness, vec3 lightPosition, vec3 lightColor, vec3 lightDir, vec3 viewDir)
{
    // Compute some useful values.
    float NdL = saturate(dot(normal, lightDir));
    float NdV = saturate(dot(normal, viewDir));
    vec3 h = normalize(lightDir + viewDir);
    float NdH = saturate(dot(normal, h));
    float VdH = saturate(dot(viewDir, h));
    float HdL = saturate(dot(h, lightDir));
    float LdV = saturate(dot(lightDir, viewDir));
    float a = max(0.0001, roughness * roughness);

    float spec = Specular_D(normal, a, NdH);
    spec *= Specular_G(a, NdV, NdL, NdH, VdH, HdL, LdV);
    spec /= (4.0 * NdL * NdV + 0.0001);
    vec3 fresnelSpec = Specular_F(specularColor, viewDir, h);

    vec3 cSpec = spec * fresnelSpec;
    vec3 cDiff = ComputeLightDiffuse(albedoColor, specularColor, cSpec);

    return lightColor * NdL * (cDiff + cSpec);
    //return  lightColor * (cDiff + cSpec);
}


/////////////////////////////////////////////////////////////////////////
//-------------------------- LIGHT EQUATION TOP OF THE POP---------------
//AUTHOR: John Hable
// http://www.filmicworlds.com/2014/04/21/optimizing-ggx-shaders-with-dotlh/
/////////////////////////////////////////////////////////////////////////

float G1V(float dotNV, float k)
{
   return 1.0/(dotNV*(1.0-k)+k);
}

float LightingFuncGGX_REF(vec3 N, vec3 V, vec3 L, float roughness, float F0)
{
        float alpha = roughness*roughness;

        vec3 H = normalize(V+L);

        float dotNL = saturate(dot(N,L));
        float dotNV = saturate(dot(N,V));
        float dotNH = saturate(dot(N,H));
        float dotLH = saturate(dot(L,H));

        float F, D, vis;

        // D
        float alphaSqr = alpha*alpha;
        float denom = dotNH * dotNH *(alphaSqr-1.0) + 1.0;
        D = alphaSqr/(PI * denom * denom);

        // F
        float dotLH5 = pow(1.0-dotLH,5.0);
        F = F0 + (1.0-F0)*(dotLH5);

        // V
        float k = alpha/2.0;
        vis = G1V(dotNL,k)*G1V(dotNV,k);

        float specular = dotNL * D * F * vis;
        return specular;
}

float LightingFuncGGX_OPT1(vec3 N, vec3 V, vec3 L, float roughness, float F0)
{
        float alpha = roughness*roughness;

        vec3 H = normalize(V+L);

        float dotNL = saturate(dot(N,L));
        float dotLH = saturate(dot(L,H));
        float dotNH = saturate(dot(N,H));

        float F, D, vis;

        // D
        float alphaSqr = alpha*alpha;
        float pi = 3.14159;
        float denom = dotNH * dotNH *(alphaSqr-1.0) + 1.0;
        D = alphaSqr/(pi * denom * denom);

        // F
        float dotLH5 = pow(1.0-dotLH,5.0);
        F = F0 + (1.0-F0)*(dotLH5);

        // V
        float k = alpha/2.0;
        vis = G1V(dotLH,k)*G1V(dotLH,k);

        float specular = dotNL * D * F * vis;
        return specular;
}


float LightingFuncGGX_OPT2(vec3 N, vec3 V, vec3 L, float roughness, float F0)
{
        float alpha = roughness*roughness;

        vec3 H = normalize(V+L);

        float dotNL = saturate(dot(N,L));

        float dotLH = saturate(dot(L,H));
        float dotNH = saturate(dot(N,H));

        float F, D, vis;

        // D
        float alphaSqr = alpha*alpha;
        float pi = 3.14159;
        float denom = dotNH * dotNH *(alphaSqr-1.0) + 1.0;
        D = alphaSqr/(pi * denom * denom);

        // F
        float dotLH5 = pow(1.0-dotLH,5.0);
        F = F0 + (1.0-F0)*(dotLH5);

        // V
        float k = alpha/2.0;
        float k2 = k*k;
        float invK2 = 1.0-k2;
        vis = rcp(dotLH*dotLH*invK2 + k2);

        float specular = dotNL * D * F * vis;
        return specular;
}

vec2 LightingFuncGGX_FV(float dotLH, float roughness)
{
        float alpha = roughness*roughness;

        // F
        float F_a, F_b;
        float dotLH5 = pow(1.0-dotLH,5.0);
        F_a = 1.0;
        F_b = dotLH5;

        // V
        float vis;
        float k = alpha/2.0;
        float k2 = k*k;
        float invK2 = 1.0-k2;
        vis = rcp(dotLH*dotLH*invK2 + k2);

        return vec2(F_a*vis,F_b*vis);
}

float LightingFuncGGX_D(float dotNH, float roughness)
{
        float alpha = roughness*roughness;
        float alphaSqr = alpha*alpha;
        float denom = dotNH * dotNH *(alphaSqr-1.0) + 1.0;

        float D = alphaSqr/(PI * denom * denom);
        return D;
}

float LightingFuncGGX_OPT3(vec3 N, vec3 V, vec3 L, float roughness, float F0)
{
        vec3 H = normalize(V+L);

        float dotNL = saturate(dot(N,L));
        float dotLH = saturate(dot(L,H));
        float dotNH = saturate(dot(N,H));

        float D = LightingFuncGGX_D(dotNH,roughness);
        vec2 FV_helper = LightingFuncGGX_FV(dotLH,roughness);
        float FV = F0*FV_helper.x + (1.0-F0)*FV_helper.y;
        float specular = dotNL * D * FV;

        return specular;
}

#ifdef _LOOKUP
float Pow4(float x)
{
        return x*x*x*x;
}

float LightingFuncGGX_OPT4(vec3 N, vec3 V, vec3 L, float roughness, float F0)
{
        vec3 H = normalize(V+L);

        float dotNL = saturate(dot(N,L));
        float dotLH = saturate(dot(L,H));
        float dotNH = saturate(dot(N,H));

        float D = g_txGgxDFV.Sample(g_samLinearClamp,vec2(Pow4(dotNH),roughness)).x;
        vec2 FV_helper =
                g_txGgxDFV.Sample(g_samLinearClamp,vec2(dotLH,roughness)).yz;

        float FV = F0*FV_helper.x + (1.0f-F0)*FV_helper.y;
        float specular = dotNL * D * FV;

        return specular;
}
#endif

/////////////////////////////////////////////////////////////////////////
//-------------------------- FILTER MAP (filmic, blur)---------
/////////////////////////////////////////////////////////////////////////
// Applies the filmic curve from John Hable's presentation
vec3 ToneMapFilmicALU(vec3 color)
{
    color = max_vec3_f(color - 0.004, 0.0);
    color = (color * (6.2 * color + 0.5)) / (color * (6.2 * color + 1.7)+ 0.06);

    return pow_vec3_f(color, 2.2);
}

// Determines the color based on exposure settings
vec3 CalcExposedColor(vec3 color, float avgLuminance, float offset, out float exposure)
{
    // Use geometric mean
    avgLuminance = max(avgLuminance, 0.001);
    float KeyValue = 0.0;/////////////////////////////////
    float keyValue = KeyValue;
    float linearExposure = (KeyValue / avgLuminance);
    exposure = log2(max(linearExposure, 0.0001));
    exposure += offset;
    return exp2(exposure) * color;
}

// Applies exposure and tone mapping to the specific color, and applies
// the threshold to the exposure value.
vec3 ToneMap(vec3 color, float avgLuminance, float threshold, out float exposure)
{
    color = CalcExposedColor(color, avgLuminance, threshold, exposure);
    color = ToneMapFilmicALU(color);
    return color;
}
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

//////////////////////
// ------ Gauss Blur
//////////////////////
// Calculates the gaussian blur weight for a given distance and sigmas
float CalcGaussianWeight(int sampleDist, float sigma)
{
    float sigma2Sq = 2.0 * sigma * sigma;
    float g = 1.0 / sqrt(3.14159 * sigma2Sq);
    return (g * exp(-(float(sampleDist * sampleDist)) / (sigma2Sq)));
}

// Performs a gaussian blur in one direction
vec4 Blur(sampler2D inputTex, vec2 texcoord, vec2 texSize, vec2 texScale, float sigma)
{
    vec4 color = vec4(0.0);
    for (int i = -6; i < 6; i++)
    {
        float weight = CalcGaussianWeight(i, sigma);
        vec2 texCoord = texcoord;
        texCoord += (vec2(i) / texSize) * texScale;
        vec4 sample = texture2D(inputTex, texCoord);
        color += sample * weight;
    }

    return color;
}

float FilterBox(float x)
{
    return 1.0;
}

float FilterTriangle(float x)
{
    return saturate(1.0 - x);
}

float FilterGaussian(float x, float sigma)
{
    float sigma2Sq = 2.0 * sigma * sigma;
    float g = 1.0 / sqrt(sigma2Sq);
    return (g * exp(-(x * x) / (sigma2Sq)));
}

 float FilterCubic(float x, float B, float C)
{
    // Rescale from [-2, 2] range to [-FilterWidth, FilterWidth]
    x *= 2.0;

    float y = 0.0;
    float x2 = x * x;
    float x3 = x * x * x;
    if(x < 1.0)
        y = (12.0 - 9.0 * B - 6.0 * C) * x3 + (-18.0 + 12.0 * B + 6.0 * C) * x2 + (6.0 - 2.0 * B);
    else if (x <= 2.0)
        y = (-B - 6.0 * C) * x3 + (6.0 * B + 30.0 * C) * x2 + (-12.0 * B - 48.0 * C) * x + (8.0 * B + 24.0 * C);

    return y / 6.0;
}

float FilterSinc(float x, float FilterSize)
{
    float s;

    x *= FilterSize;

    if(x < 0.001)
        s = 1.0;
    else
        s = sin(x * PI) / (x * PI);

    return s;
}

float FilterBlackmanHarris(float x)
{
    x = 1.0 - x;

    const float a0 = 0.35875;
    const float a1 = 0.48829;
    const float a2 = 0.14128;
    const float a3 = 0.01168;
    return saturate(a0 - a1 * cos(PI * x) + a2 * cos(2.0 * PI * x) - a3 * cos(3.0 * PI * x));
}

float FilterSmoothstep(float x)
{
    return 1.0 - smoothstep(0.0, 1.0, x);
}

#define FilterType_ 0

float Filter(float x, float FilterParam)
{
    //return FilterGaussian(x, FilterParam);

    #if FilterType_ == 0
        return FilterBox(x);
    #elif FilterType_ == 1
        return FilterTriangle(x);
    #elif FilterType_ == 2
        return FilterGaussian(x, FilterParam);
    #elif FilterType_ == 3
        return FilterBlackmanHarris(x);
    #elif FilterType_ == 4
        return FilterSmoothstep(x);
    #elif FilterType_ == 5
        return FilterCubic(x, 1.0, 0.0);
    #elif FilterType_ == 6
        return FilterCubic(x, 0.0, 0.5);
    #elif FilterType_ == 7
        return FilterCubic(x, 1.0 / 3.0, 1.0 / 3.0);
    #elif FilterType_ == 8
        return FilterCubic(x, CubicB, CubicC);
    #elif FilterType_ == 9
        float FilterSize = 1.0f;
        return FilterSinc(x, FilterSize);
    #endif
}

// Performs a gaussian blur in one direction
vec3 BlurTextureSphere(sampler2D inputTex, vec3 texcoord, vec2 texSize, float FilterSize)
{

    vec2 vN;
    vN.y = -texcoord.y;
    vN.x = atan( texcoord.z,  texcoord.x ) * INVPI;
    vN = vN * vec2(0.5) + vec2(0.5);
    vec2 pixelPos = vN;

#define SAMPLE_RADIUS 3

    vec3 sampleClear = decodeRGBE(texture2D(inputTex, pixelPos));
    vec3 sum = vec3(0.0);
    float totalWeight = 0.0;

    for(int y = -SAMPLE_RADIUS; y <= SAMPLE_RADIUS; ++y)
    {
        for(int x = -SAMPLE_RADIUS; x <= SAMPLE_RADIUS; ++x)
        {
            vec2 sampleOffset = vec2(x, y) / texSize;
            vec2 samplePos = pixelPos + sampleOffset;
            float sampleDist = length(sampleOffset);
            if ( sampleDist != 0.0 ) {
                vec2 samplePos = pixelPos + sampleOffset;
                vec3 sample = decodeRGBE(texture2D(inputTex, samplePos));
                float weight = Filter(sampleDist, FilterSize*64.0);
                sum += sample * weight;
                totalWeight += weight;
            }
        }
    }

    sum = sum / max(totalWeight, 0.00001);
    sum = max(sum, vec3(0.0));
    return mix(sampleClear, sum, FilterSize );
}

///////////////////////////////////////////////////////////////
//-------------------------- NORMAL MAP (derivatives or tangent)---------
/////////////////////////////////////////////////////////////////////////
#define WITH_NORMALMAP_UNSIGNED 1
//#define WITH_NORMALMAP_2CHANNEL 1
//#define WITH_NORMALMAP_GREEN_UP 1
vec3 readNormal(sampler2D normalMap, vec2 texcoord){
    vec3 map = texture2D(normalMap, texcoord).xyz;
#ifdef WITH_NORMALMAP_UNSIGNED
    map = map * 255./127. - 128./127.;
#endif
#ifdef WITH_NORMALMAP_2CHANNEL
    map.z = sqrt( 1. - dot( map.xy, map.xy ) );
#endif
#ifdef WITH_NORMALMAP_GREEN_UP
    map.y = -map.y;
#endif
    return map;
    //return normalize(map);
}

#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#define USE_DERIVATIVES 1
#endif

#ifdef USE_DERIVATIVES
// better, faster, stronger and no need of tangents...
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

vec3 perturb_normal( vec3 N, vec3 bump, vec3 V, vec2 texcoord )
{
    mat3 TBN = cotangent_frame( N, -V, texcoord );
    return normalize( TBN * bump );
}
#else

vec3 perturb_normal( vec3 N, vec3 T,  vec3 bump, vec3 V, vec2 texcoord )
{
    vec3 wbitangent = cross(N, T);
    mat3 TBN = mat3(T, wbitangent, N);
    vec3 n = normalize(t2w * bump);
    return n;
}

#endif

/////////////////////////////////////////////////////////////////////////
//-------------------------- SPECULAR AA---------------------------------
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
// ===============================================================================
// Computes a new roughness value for a single mipmap texel given a normal map
// and an existing roughness value
// Frequency Domain Normal Map Filtering Han et al. [2007a]
// http://blog.selfshadow.com/publications/s2013-shading-course/rad/s2013_pbs_rad_notes.pdf p20
// ===============================================================================
#ifdef MIP_LEVEL_COMPUTE_CONSTANT_WEBGLII
float ComputeRoughness(vec2 texelPos, int mipLevel, float roughness, sampler2D NormalMap)
{
    if( mipLevel == 0 ){
        return roughness;
    }
    else  {
        vec3 avgNormal = vec3(0.0);
        // Sample all normal map texels from the base mip level that are within
        // the footprint of the current mipmap texel
        int texelFootprint = int(pow(float(mipLevel), 2.0));
        vec2 topLeft = vec2((-float(texelFootprint) / 2.0) + 0.5);
        for(int y = 0; y < texelFootprint; ++y) {
            for(int x = 0; x < texelFootprint; ++x) {
                vec2 offset = topLeft + vec2(x, y);
                vec2 samplePos = floor(texelPos + offset) + 0.5;
                vec3 sampleNormal = texture2D(NormalMap, samplePos).xyz;
                sampleNormal = normalize(sampleNormal * 2.0 - 1.0);
                avgNormal += sampleNormal;
            }
        }
        // Fit a vMF lobe to NDF for this mip texel
        avgNormal /= float(texelFootprint * texelFootprint);
        float r = length(avgNormal);
        float kappa = 10000.0;
        if(r < 1.0)
            kappa = (3.0 * r - r * r * r) / (1.0 - r * r);
        // Compute the new roughness value
        return sqrt(roughness * roughness + (1.0 / kappa));
    }
}
#endif
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
 uniform float LightAmbientIntensity;
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
#endif

  vec4 lightPosition = lightPos;
  vec3 lightColor = LightColor.xyz;
  float lightIntensity = LightIntensity;
  float lightAmbientIntensity = LightAmbientIntensity;

    // Compute view direction.
  vec4 pos = position;// / position.w;
    vec3 viewDir = normalize(eyePos.xyz - pos.xyz);
    vec3 lightDist = lightPos.xyz - pos.xyz;
    vec3 lightDir = normalize(lightDist);

#ifdef USE_NORMAL_MAP
    vec3 normalN = readNormal(Texture3, texcoord0.xy);

    #ifdef USE_DERIVATIVES
          normalN = perturb_normal( normal.xyz, normalN, -viewDir, texcoord0.xy );
    #else
          normalN = perturb_normal( normal.xyz, tangent.xyz, normalN, -viewDir, texcoord0.xy );
    #endif

    #ifdef USE_TOKSVIG
          // mipmap normal map
       #ifdef USE_GLOSSINESS
          roughness = Gloss(normalN, roughness);
       #else
          roughness = Gloss(normalN, 1.0 - roughness);
       #endif
    #elif defined(USE_MCKAULY)
          roughness = ComputeRoughness(texcoord0.xy, mipLevel, roughness, Texture3)
    #endif

#else
    vec3 normalN = normal.xyz;
#endif


#ifdef METALLIC
    // Lerp with metallic value to find the good diffuse and specular.
    vec3 realAlbedo = albedoColor - albedoColor * metallic;
    // 0.03 default specular value for dielectric.
    vec3 realSpecularColor = mix(vec3(0.03), albedoColor, metallic);
#else // defined(SPECULAR)
    vec3 realAlbedo = albedoColor;
    vec3 realSpecularColor = Specular.xyz;;
#endif



   vec3 light1;

#ifdef EQUATION_OPT

    light1 = ComputeLight( realAlbedo.xyz, realSpecularColor.xyz,  normalN.xyz,  roughness,  lightPos.xyz, lightColor.xyz, lightDir.xyz, viewDir.xyz);

#else

    float cSpec;

#ifdef GGX_REF
    cSpec = LightingFuncGGX_REF(normalN.xyz, viewDir.xyz, lightDir.xyz, roughness, metallic);
#elif defined(GGX_1)
    cSpec = LightingFuncGGX_OPT1(normalN.xyz, viewDir.xyz, lightDir.xyz, roughness, metallic);
#elif defined(GGX_2)
    cSpec = LightingFuncGGX_OPT2(mormalN.xyz, viewDir.xyz, lightDir.xyz, roughness, metallic);
#else //defined(GGX_3)
    cSpec = LightingFuncGGX_OPT3(normalN.xyz, viewDir.xyz, lightDir.xyz, roughness, metallic);
#endif

vec3 cDiff = ComputeLightDiffuse(realAlbedo.xyz, realSpecularColor.xyz, vec3(cSpec));
float dotNL = saturate(dot(normalN.xyz,lightDir.xyz));
light1 = lightColor *  (dotNL *cDiff + cSpec*realSpecularColor);

#endif


    float lightDistLength = length(lightDist);
//lightDistLength *= lightDistLength;
    float attenuation =  PI / lightDistLength;
    light1 = lightIntensity *attenuation * light1 ;

    vec3 envContrib = vec3(0.0);
    vec3 irradiance = vec3(0.0);
#ifdef USE_ENV_MAP

//float mipIndex =  roughness * roughness * 8; // missing http://www.khronos.org/registry/webgl/extensions/EXT_shader_texture_lod/
float mipIndex =  roughness * roughness ; //instead we blur 9 tap and use roughness as a "blur" lerp index

irradiance = BlurTextureSphere(Texture5, normalN, vec2(360.0, 180.0), mipIndex);
//irradiance = decodeRGBE(textureSphere(Texture5, normalN ));

       vec3 reflectVector = cubemapReflectionVector(CubemapTransform, -viewDir, normalN);

vec3 envColor = BlurTextureSphere(Texture4, reflectVector, vec2(2048.0, 1024.0), mipIndex);
//vec3 envColor = decodeRGBE(textureSphere(Texture4, reflectVector ));

        vec3 envFresnel = Specular_F_Roughness(realSpecularColor, roughness * roughness, normalN, viewDir);
        envContrib = envFresnel * envColor;

#endif
vec3 linearColor;

linearColor =  (light1 + realAlbedo*irradiance*lightAmbientIntensity + envContrib*lightAmbientIntensity);

//linearColor = irradiance.xyz;
//linearColor = envColor.xyz;

    gl_FragColor = vec4(ToSRGB(Exposure + linearColor, Gamma), 1.0);

}
