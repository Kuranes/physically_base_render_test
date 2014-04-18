precision highp float;

attribute vec3 Vertex;
attribute vec3 Normal;
attribute vec2 TexCoord0;
uniform mat4 ModelViewMatrix;
uniform mat4 ProjectionMatrix;
uniform mat4 NormalMatrix;

varying vec3 osg_FragNormal;
varying vec3 osg_FragEye;
varying vec3 osg_FragVertex;
varying vec2 osg_TexCoord0;

void main(void) {
    osg_FragVertex = Vertex;
    osg_TexCoord0 = TexCoord0;
    vec4 modelVertex = ModelViewMatrix * vec4(Vertex,1.0);
    osg_FragEye = modelVertex.xyz;
    osg_FragNormal = vec3(NormalMatrix * vec4(Normal, 1.0));
    gl_Position = ProjectionMatrix * modelVertex;
}
