
attribute vec3 Vertex;
attribute vec3 Normal;
attribute vec2 TexCoord0;
attribute vec4 Tangent;

uniform mat4 ModelViewMatrix;
uniform mat4 ProjectionMatrix;
uniform mat4 NormalMatrix;

uniform vec4 lightPos;
uniform vec4 eyePos;

varying vec4 position;
varying vec4 normal;
varying vec4 tangent;
varying vec2 texcoord0;


void main(void) {
    position = ModelViewMatrix * vec4(Vertex, 1.0);
    normal   = NormalMatrix    * vec4(Normal, 1.0);
    tangent  = NormalMatrix    * Tangent;
    texcoord0 = TexCoord0;

    gl_Position = ProjectionMatrix * position;

}
