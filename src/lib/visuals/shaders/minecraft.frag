
precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform int iFrame;
uniform int uMaxIter;


mat3 rotz(float a)
{
    float c = cos(a), s = sin(a);
    return mat3(c,-s,0,s,c,0,0,0,1);
}

float sdHexPrism( vec3 p, vec2 h )
{
    vec3 q = abs(p);
    const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
    p = abs(p);
    p.xy -= 2.0*min(dot(k.xy, p.xy), 0.0)*k.xy;
    vec2 d = vec2(
       length(p.xy - vec2(clamp(p.x, -k.z*h.x, k.z*h.x), h.x))*sign(p.y - h.x),
       p.z-h.y );
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

// hexagons repeat placement
#define ox 1.3
#define oz 1.5

// variation between 0 and 1 along p.z
float var_z = 0.0;

// common part used by the map and mat functions
// return the two sdf's
void common_map(vec3 p, out float df0, out float df1)
{
	p *= rotz(p.z * 0.05);
	
	p.y = 5.0 + 5.0 * var_z - abs(p.y);
	
    // the horizontal wave
	float wave = sin(length(p.xz) * 0.25 - iTime * 1.5);
	df0 = abs(p.y + wave) - 1.0;
	
	vec2 hex_size = vec2(0.25 + p.y * 0.25, 10.0);
	
    // first hexagones row
	vec3 q0 = p;
	q0.x = mod(q0.x - ox, ox + ox) - ox;
	q0.z = mod(q0.z - oz * 0.5, oz) - oz * 0.5;
	float hex0 = sdHexPrism(q0.xzy, hex_size) - 0.2; 
	
    // second hexagones row
	vec3 q1 = p;
	q1.x = mod(q1.x, ox + ox) - ox;
	q1.z = mod(q1.z, oz) - oz * 0.5;
	float hex1 = sdHexPrism(q1.xzy, hex_size) - 0.2; 
	
    // the hexagones
	df1 = min(hex0, hex1);
}

// from IQ
float smin( float a, float b, float k )
{
	float h = clamp( 0.5 + 0.5*(b-a)/k, 0.0, 1.0 );
	return mix( b, a, h ) - k*h*(1.0-h);
}

float smax(float a, float b, float k)
{
    return smin(a, b, -k);
}

// return the final SDF
float map(vec3 p)
{
    float df0, df1;
    common_map(p, df0, df1);
    
    // final df
    return smax(df0, df1, 0.1);
    //return max(df0, df1);
}

// same code as map but with decomposition of the last max()
// for return the material id
float mat(vec3 p)
{
	float df0, df1;
    common_map(p, df0, df1);
    
    // max() decomposition for get df id
	if (df0 > df1)
		return 1.0;
	return 0.0;
}

// get normal for the surface point and a precision
vec3 getNormal(vec3 p)
{
	const vec3 e = vec3(0.1, 0, 0);
	return normalize(vec3(
		map(p+e)-map(p-e),
		map(p+e.yxz)-map(p-e.yxz),
		map(p+e.zyx)-map(p-e.zyx)));
}

// IQ Occ
float getAmbiantOcclusion(vec3 p, vec3 n, float k)
{
    const float aoStep = 0.1; 
	float occl = 0.;
    for(int i = min(iFrame,0); i < 6; ++i)
    {
        float diff = float(i)*aoStep;
        float d = map(p + n*diff);
        occl += (diff - d) * pow(2., float(-i));
    }
    return min(1., 1. - k*occl);
}

// IQ Shadow
float getShadow(vec3 ro, vec3 rd, float minD, float maxD, float k)
{
    float res = 1.0;
    float d = minD;
	float s = 0.;
    int shadowIter = min(max(4, uMaxIter / 8), 20);
    for(int i = min(iFrame,0); i < shadowIter; ++i)
    {
        s = map(ro + rd * d);
        if( abs(s)<d*d*1e-5 ) return 0.0;
        res = min( res, k * s / d );
		d += s;
        if(d >= maxD) break;
    }
    return res;
}

// get the perpsective camera
vec3 cam(vec2 uv, vec3 ro, vec3 cv, float fov)
{
	vec3 cu = normalize(vec3(0,1,0));
  	vec3 z = normalize(cv-ro);
    vec3 x = normalize(cross(cu,z));
  	vec3 y = cross(z,x);
  	return normalize(z + fov*uv.x*x + fov*uv.y*y);
}

// from IQ https://www.shadertoy.com/view/MsS3Wc
// Smooth HSV to RGB conversion 
vec3 hsv2rgb_smooth( in vec3 c )
{
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
	rgb = rgb*rgb*(3.0-2.0*rgb); // cubic smoothing	
	return c.z * mix( vec3(1.0), rgb, c.y);
}

// Varyings from vertex shader
varying vec2 vUV;

void main()
{
    // Test that uniforms are working with a simple animated pattern
    vec2 uv = vUV - 0.5; // center the UV coordinates
    float time = iTime * 0.5;
    
    // Create a simple animated tunnel effect
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);
    
    // Animated tunnel stripes
    float stripes = sin(radius * 10.0 - time * 3.0) * 0.5 + 0.5;
    float rotation = sin(angle * 6.0 + time) * 0.5 + 0.5;
    
    vec3 color = vec3(stripes * rotation, stripes, rotation);
    
    gl_FragColor = vec4(color, 1.0);
}