/*global osg:false,  OSG :false, osgViewer: false, osgDB: false, Q: false, dat: false*/

var preLoadImg = [ 'textures/Albedo.png',
                   'textures/Cerberus_A.png',
                   'textures/Roughness.png',
                   'textures/Cerberus_R.png',
                   'textures/Metallic.png',
                   'textures/Cerberus_M.png',
                   'textures/Normal.png',
                   'textures/Cerberus_N.png'
                 ];

preLoadImg.forEach( function ( urlImg ) {
    var img = new Image();
    img.src = urlImg;
} );

var main = function () {

  var viewer;
  var textureHigh;
  var textureEnv;
    var background;

    // from require to global var
    OSG.globalify();

function decodeHDRHeader(buf) {
    var info = {exposure: 1.0};

    // find header size
    var size = -1, size2 = -1;
    for (var i = 0; i < buf.length - 1; i++) {
        if (buf[i] == 10 && buf[i + 1] == 10) {
            size = i;
            break;
        }
    }
    for (var i = size + 2; i < buf.length - 1; i++) {
        if (buf[i] == 10) {
            size2 = i;
            break;
        }
    }

    // convert header from binary to text lines
    var header = String.fromCharCode.apply(null, new Uint8Array(buf.subarray(0, size))); // header is in text format
    var lines = header.split("\n");
    if (lines[0] != "#?RADIANCE") {
        console.error("Invalid HDR image.");
        return false;
    }
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var matches = line.match(/(\w+)=(.*)/i);
        if (matches != null) {
            var key = matches[1],
                value = matches[2];

            if (key == "FORMAT")
                info.format = value;
            else if (key == "EXPOSURE")
                info.exposure = parseFloat(value);
        }
    }

    // fill image resolution
    var line = String.fromCharCode.apply(null, new Uint8Array(buf.subarray(size + 2, size2)));
    var matches = line.match(/-Y (\d+) \+X (\d+)/);
    info.width = parseInt(matches[2]);
    info.height = parseInt(matches[1]);
    info.scanline_width = parseInt(matches[2]);
    info.num_scanlines = parseInt(matches[1]);

    info.size = size2 + 1;
    return info;
}

// Read a radiance .hdr file (http://radsite.lbl.gov/radiance/refer/filefmts.pdf)
// Ported from http://www.graphics.cornell.edu/~bjw/rgbe.html
osg.readHDRImage = function(url, options) {
    if (options === undefined) {
        options = {};
    }

    var img = {
        'data': null,
        'width': 0,
        'height': 0
    };

    // download .hdr file
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = "arraybuffer";

    var defer = Q.defer();
    xhr.onload = function (ev) {
        if (xhr.response) {
            var bytes = new Uint8Array(xhr.response);

            var header = decodeHDRHeader(bytes);
            if (header == false)
                return;

            // initialize output buffer
            var data = new Uint8Array(header.width * header.height * 4);
            var img_offset = 0;

            if ((header.scanline_width < 8)||(header.scanline_width > 0x7fff)) {
                console.error('not rle compressed .hdr file');
                return;
            }

            // read in each successive scanline
            var scanline_buffer = new Uint8Array(4 * header.scanline_width);
            var read_offset = header.size;
            var num_scanlines = header.num_scanlines;
            while (num_scanlines > 0) {
                var offset = 0;
                var rgbe = [bytes[read_offset++], bytes[read_offset++], bytes[read_offset++], bytes[read_offset++]];
                var buf = [0, 0];

                if ((rgbe[0] != 2) || (rgbe[1] != 2) || (rgbe[2] & 0x80)) {
                    console.error('this file is not run length encoded');
                    return;
                }

                if (((rgbe[2]) << 8 | rgbe[3]) != header.scanline_width) {
                    console.error('wrong scanline width');
                    return;
                }

                // read each of the four channels for the scanline into the buffer
                for (var i=0;i<4;i++) {
                    var offset_end = (i + 1) * header.scanline_width;
                    while (offset < offset_end) {
                        buf[0] = bytes[read_offset++];
                        buf[1] = bytes[read_offset++];

                        if (buf[0] > 128) {
                            // a run of the same value
                            count = buf[0] - 128;
                            if ((count == 0) || (count > offset_end - offset)) {
                                console.error('bad scanline data');
                                return;
                            }
                            while (count-- > 0)
                                scanline_buffer[offset++] = buf[1];
                        } else {
                            // a non-run
                            count = buf[0];
                            if ((count == 0) || (count > offset_end - offset)) {
                                console.error('bad scanline data');
                                return;
                            }
                            scanline_buffer[offset++] = buf[1];

                            if (--count > 0) {
                                while (count-- > 0) {
                                    scanline_buffer[offset++] = bytes[read_offset++];
                                }
                            }
                        }
                    }
                }

                // fill the image array
                for (var i = 0; i < header.scanline_width; i++) {
                    data[img_offset++] = scanline_buffer[i];
                    data[img_offset++] = scanline_buffer[i + header.scanline_width];
                    data[img_offset++] = scanline_buffer[i + 2 * header.scanline_width];
                    data[img_offset++] = scanline_buffer[i + 3 * header.scanline_width];
                }

                num_scanlines--;
            }

            // send deferred info
            img.data = data;
            img.width = header.width;
            img.height = header.height;
            defer.resolve(img);
        }
    }

    // async/defer
    xhr.send(null);
    return defer.promise;
}

var SphereEnvMap = function(viewer) {
    this._viewer = viewer;
}

function readImageURL(url) {
    var ext = url.split('.').pop();
    if(ext == "hdr")
        return osg.readHDRImage(url);

    return osgDB.readImageURL(url);
}

function getEnvSphere(size, scene)
{
    // create the environment sphere
    //var geom = osg.createTexturedSphere(size, 32, 32);
    var geom = osg.createTexturedBoxGeometry(0,0,0, size,size,size);
    geom.getOrCreateStateSet().setAttributeAndModes(new osg.CullFace('DISABLE'));
    geom.getOrCreateStateSet().setAttributeAndModes(getShaderBackground());

    var cubemapTransform = osg.Uniform.createMatrix4(osg.Matrix.makeIdentity([]), "CubemapTransform");
    var mt = new osg.MatrixTransform();
    mt.setMatrix(osg.Matrix.makeRotate(Math.PI/2.0, 1,0,0,[]));
    mt.addChild(geom);
    var CullCallback = function() {
        this.cull = function(node, nv) {
            // overwrite matrix, remove translate so environment is always at camera origin
            osg.Matrix.setTrans(nv.getCurrentModelviewMatrix(), 0,0,0);
            var m = nv.getCurrentModelviewMatrix();
            osg.Matrix.copy(m, cubemapTransform.get());
            cubemapTransform.dirty();
            return true;
        }
    }
    mt.setCullCallback(new CullCallback());
    scene.getOrCreateStateSet().addUniform(cubemapTransform);

    var cam = new osg.Camera();
    cam.setReferenceFrame(osg.Transform.ABSOLUTE_RF);
    cam.addChild(mt);

    var self = this;
    // the update callback get exactly the same view of the camera
    // but configure the projection matrix to always be in a short znear/zfar range to not vary depend on the scene size
    var UpdateCallback = function() {
        this.update = function(node, nv) {
            var rootCam = viewer.getCamera();

            //rootCam.
            var info = {};
            osg.Matrix.getPerspective(rootCam.getProjectionMatrix(), info);
            var proj = [];
            osg.Matrix.makePerspective(info.fovy, info.aspectRatio, 1.0, 100.0, proj);
            cam.setProjectionMatrix(proj);
            cam.setViewMatrix(rootCam.getViewMatrix());

            return true;
        };
    };
    cam.setUpdateCallback(new UpdateCallback());
    scene.addChild(cam);

    return geom;
}

function getShaderBackground()
{
    var vertexshader = [
        "",
        "#ifdef GL_ES",
        "precision highp float;",
        "#endif",
        "attribute vec3 Vertex;",
        "attribute vec3 Normal;",
        "attribute vec2 TexCoord0;",
        "uniform mat4 ModelViewMatrix;",
        "uniform mat4 ProjectionMatrix;",
        "uniform mat4 NormalMatrix;",

        "varying vec3 osg_FragNormal;",
        "varying vec3 osg_FragEye;",
        "varying vec3 osg_FragVertex;",
        "varying vec2 osg_TexCoord0;",

        "void main(void) {",
        "  osg_FragVertex = Vertex;",
        "  osg_TexCoord0 = TexCoord0;",
        "  osg_FragEye = vec3(ModelViewMatrix * vec4(Vertex,1.0));",
        "  osg_FragNormal = vec3(NormalMatrix * vec4(Normal, 1.0));",
        "  gl_Position = ProjectionMatrix * ModelViewMatrix * vec4(Vertex,1.0);",
        "}"
    ].join('\n');

    var fragmentshader = [
        "",
        "#ifdef GL_ES",
        "precision highp float;",
        "#endif",
        "#define PI 3.14159",

        "uniform sampler2D Texture0;",
        "uniform float Exposure;",
        "uniform float Gamma;",

        "varying vec3 osg_FragNormal;",
        "varying vec3 osg_FragEye;",
        "varying vec3 osg_FragVertex;",
        "varying vec2 osg_TexCoord0;",

        // convert 8-bit RGB channels into floats using the common E exponent
        "vec3 decodeRGBE(vec4 rgbe) {",
        "  float f = pow(2.0, rgbe.w * 255.0 - (128.0 + 8.0));",
        "  return rgbe.rgb * 255.0 * f;",
        "}",

        // apply some gamma correction (http://www.geeks3d.com/20101001/tutorial-gamma-correction-a-story-of-linearity/)
        "vec3 toneMapHDR(vec3 rgb) {",
        "  return pow(rgb * Exposure, 1.0 / vec3(Gamma));",
        "}",

        // fetch from environment sphere texture
        "vec4 textureSphere(sampler2D tex, vec3 n) {",
        "  float yaw = acos(n.y) / PI;",
        "  float pitch = (atan(n.x, n.z) + PI) / (2.0 * PI);",
        "  return texture2D(tex, vec2(pitch, yaw));",
        "}",

        "void main(void) {",
        "  vec3 normal = normalize(osg_FragVertex.xyz);",
        "  vec3 c = toneMapHDR(decodeRGBE(textureSphere(Texture0, normal)));",
        "  gl_FragColor = vec4(c, 1.0);",
        "}",
        ""
    ].join('\n');

    var program = new osg.Program(
        new osg.Shader('VERTEX_SHADER', vertexshader),
        new osg.Shader('FRAGMENT_SHADER', fragmentshader));

    return program;
}


// change the environment maps (reflective included)
// Images are 8-bit RGBE encoded based on the radiance file format
// The example supports radiance .hdr files, but uses .png which contains the exact same information for better size and speed.
function setEnvironment(name) {
    var texturesEnvList = {
        'Alexs_Apartment': ['Alexs_Apt_2k.png', 'Alexs_Apt_Env.png'],
        'Arches_E_PineTree': ['Arches_E_PineTree_3k.png', 'Arches_E_PineTree_Env.png'],
        'GrandCanyon_C_YumaPoint': ['GCanyon_C_YumaPoint_3k.png', 'GCanyon_C_YumaPoint_Env.png'],
        'Milkyway': ['Milkyway_small.png', 'Milkyway_Light.png'],
        'Walk_Of_Fame': ['Mans_Outside_2k.png', 'Mans_Outside_Env.png']
    };
    var urls = texturesEnvList[name];

    Q.all([
            readImageURL('textures/' + name + '/' + urls[0]),
            readImageURL('textures/' + name + '/' + urls[1])]).then(function(images) {
                textureHigh = new osg.Texture();
                textureHigh.setImage(images[0]);
                if(images[0].data) {
                    textureHigh.setTextureSize(images[0].width, images[0].height);
                    textureHigh.setImage(images[0].data, osg.Texture.RGBA);
                }
                background.getOrCreateStateSet().setTextureAttributeAndMode(0, textureHigh);
                background.getOrCreateStateSet().addUniform(osg.Uniform.createInt1(0,'Texture0'));

                textureEnv = new osg.Texture();
                textureEnv.setImage(images[1]);
                if(images[0].data) {
                    textureEnv.setTextureSize(images[0].width, images[0].height);
                    textureEnv.setImage(images[0].data, osg.Texture.RGBA);
                }

                myStateSet.setTextureAttributeAndMode(4, textureHigh, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE);
                myStateSet.setTextureAttributeAndMode(5, textureEnv, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE);
                //updateShader();
            });
}

    var cbFocusCamera = function () {
        viewer.getManipulator()
            .computeHomePosition();
    };

    var rootModelNode = new osg.MatrixTransform();
    rootModelNode.setMatrix( osg.Matrix.makeRotate( -Math.PI / 2, 1, 0, 0, [] ) );

    var myStateSet;

    var specPower = osg.Uniform.createFloat1( 30.0, 'specPower' );
    var Albedo = osg.Uniform.createFloat4( [ 0.5, 0.0, 0.0, 1.0 ], 'Albedo' );
    var Specular = osg.Uniform.createFloat4( [ 0.0, 0.7, 0.0, 1.0 ], 'Specular' );
    var Metallic = osg.Uniform.createFloat( 0.1, 'Metallic' );
    var Roughness = osg.Uniform.createFloat( 0.1, 'Roughness' );
    var lightIntensity = osg.Uniform.createFloat( 0.1, 'LightIntensity' );
    var lightColor = osg.Uniform.createFloat4( [ 1.0, 1.0, 1.0, 1.0 ], 'LightColor' );
    var gamma = osg.Uniform.createFloat( 2.2, 'Gamma' );

    // HDR parameters uniform
    var exposure = osg.Uniform.createFloat1(1, 'Exposure');

    var DiffuseMapUniform = osg.Uniform.createInt( 0, 'Texture0' );
    var RoughnessMapUniform = osg.Uniform.createInt( 1, 'Texture1' );
    var MetallicMapUniform = osg.Uniform.createInt( 2, 'Texture2' );
    var NormalMapUniform = osg.Uniform.createInt( 3, 'Texture3' );

    var getTexture = function (url){
        var texture = osg.Texture.createFromURL( url );
        texture.setMinFilter(osg.Texture.LINEAR_MIPMAP_LINEAR);
        texture.setMagFilter(osg.Texture.LINEAR);
        return texture;
    }
    var updateTexture = function ( ) {

        switch ( pbrGui.DiffuseMap ) {
        case 'NONE':
            myStateSet.removeTextureAttribute( 0, undefined, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            break;
        case 'BASE':
            myStateSet.setTextureAttributeAndMode( 0, getTexture( 'textures/Albedo.png' ), osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            break;
        case 'CERBERUS':

            myStateSet.setTextureAttributeAndMode( 0, getTexture( 'textures/Cerberus_A.png' ), osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            break;
        }
        switch ( pbrGui.RoughnessMap ) {
        case 'NONE':
            myStateSet.removeTextureAttribute( 1, undefined, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            break;
        case 'BASE':
            myStateSet.setTextureAttributeAndMode( 1, getTexture( 'textures/Roughness.png' ), osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            break;
        case 'CERBERUS':
            myStateSet.setTextureAttributeAndMode( 1, getTexture( 'textures/Cerberus_R.png' ), osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            break;
        }

        switch ( pbrGui.MetallicMap ) {
        case 'NONE':
            myStateSet.removeTextureAttribute( 2, undefined, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            break;
        case 'BASE':
            myStateSet.setTextureAttributeAndMode( 2, getTexture( 'textures/Metallic.png' ), osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            break;
        case 'CERBERUS':
            myStateSet.setTextureAttributeAndMode( 2, getTexture( 'textures/Cerberus_M.png' ), osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            break;
        }

        switch ( pbrGui.NormalMap ) {
        case 'NONE':
            myStateSet.removeTextureAttribute( 3, undefined, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            break;
        case 'BASE':
            myStateSet.setTextureAttributeAndMode( 3, getTexture( 'textures/Normal.png' ), osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            break;
        case 'CERBERUS':
            myStateSet.setTextureAttributeAndMode( 3, getTexture( 'textures/Cerberus_N.png' ), osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            break;
        }

        switch ( pbrGui.EnvMap ) {
        case 'NONE':
            myStateSet.removeTextureAttribute( 3, undefined, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            break;
        default:
            setEnvironment(pbrGui.EnvMap);
            break;
        }

    };

    var updateShader = function ( ) {
        updateTexture();

        myStateSet.setAttributeAndMode( getShader() );

        myStateSet.addUniform( specPower );
        myStateSet.addUniform( Albedo );
        myStateSet.addUniform( Specular );
        myStateSet.addUniform( Metallic );
        myStateSet.addUniform( Specular );
        myStateSet.addUniform( Roughness );
        myStateSet.addUniform( lightIntensity );
        myStateSet.addUniform( lightColor );
        myStateSet.addUniform( gamma );
        myStateSet.addUniform( exposure );

    };

    var GUIPARAMS = function () {
        this.model = 'materialTest';
        this.Albedo = [ 255.0, 200.0, 200.0, 1.0 ];
        this.Specular = [ 0.0, 200.0, 200.0, 1.0 ];
        this.Roughness = 0.7;
        this.Dielectric = 0.6;
        this.lightIntensity = 1.0;
        this.gamma = 2.2;
        this.lightColor = [ 255.0, 255.0, 255.0, 1.0 ];
        this.metallicSpecularDefine = 'METALLIC';
        this.normalDistributionDefine = 'GGX';
        this.fresnelDefine = 'SCHLICK';
        this.geometryDefine = 'SMITH_SCHLICK_GGX';
        this.energyRatioDefine = 'FresnelDiff';
        this.roughnessGlossinessDefine = 'ROUGHNESS';
        this.DiffuseMap = 'NONE';
        this.NormalMap = 'BASE';
        this.RoughnessMap = 'NONE';
        this.MetallicMap = 'NONE';
        this.EnvMap = 'Milkyway';
        this.specAA = 'TOKSVIG'
        this.reload = updateShader;
      this.Precision = 'HIGH';
    };

    var pbrGui = new GUIPARAMS();

    var update = function ( ) {
        // This is calculated each time;
        specPower.set( 30.0 );

        Albedo.get()[ 0 ] = pbrGui.Albedo[ 0 ] / 255.0;
        Albedo.get()[ 1 ] = pbrGui.Albedo[ 1 ] / 255.0;
        Albedo.get()[ 2 ] = pbrGui.Albedo[ 2 ] / 255.0;
        Albedo.get()[ 3 ] = pbrGui.Albedo[ 3 ];
        Albedo.dirty();

        Specular.get()[ 0 ] = pbrGui.Specular[ 0 ] / 255.0;
        Specular.get()[ 1 ] = pbrGui.Specular[ 1 ] / 255.0;
        Specular.get()[ 2 ] = pbrGui.Specular[ 2 ] / 255.0;
        Specular.get()[ 3 ] = pbrGui.Specular[ 3 ];
        Specular.dirty();

        Metallic.set( pbrGui.Dielectric );

        Roughness.set( pbrGui.Roughness );

        lightIntensity.set( pbrGui.lightIntensity );

        gamma.set( pbrGui.gamma );

        lightColor.get()[ 0 ] = pbrGui.lightColor[ 0 ] / 255.0;
        lightColor.get()[ 1 ] = pbrGui.lightColor[ 1 ] / 255.0;
        lightColor.get()[ 2 ] = pbrGui.lightColor[ 2 ] / 255.0;
        lightColor.get()[ 3 ] = pbrGui.lightColor[ 3 ];
        lightColor.dirty();

        var elements = document.getElementsByClassName( 'selector' );
        var i = elements.length;
        while ( i-- ) {
            elements[ i ].style.width = '128px';
        }
    };
    update();

    function getModelJson( modelName ) {
        var urlModel;
        var jsonp = true;

        switch ( modelName ) {
        case 'mickey':
            urlModel = 'http://osgjs.org/examples/pointcloud/' + modelName + '.osgjs';
            break;
        case 'pokerscene':
            urlModel = 'http://osgjs.org/examples/pokerscene/' + modelName + '.js';
            break;
        case 'ogre':
            urlModel = 'http://osgjs.org/examples/shadow/' + modelName + '.osgjs';
            break;
        case 'raceship':
            urlModel = 'http://osgjs.org/examples/ssao/' + modelName + '.osgjs';
            jsonp = false;
            break;
        case 'materialTest':
            urlModel = window.location.origin + window.location.pathname + 'models/' + modelName + '.osgjs';
            jsonp = false;
            break;
        case 'gun':
            urlModel = window.location.origin + window.location.pathname + 'models/' + modelName + '.osgjs';
            jsonp = false;
            break;
        }

        var NodeModel;
        var dataProxyLoader;


        var parseModel = function () {

            // add hook to use the manager when loading osgjs files
            var opts = {};
            // replace readImageURL of osgjs
            // we want to reference image in or resource manager and manage the loading as well
            var createReadImageURLFunction = function ( url, options ) {
                // here we are in the context of Input.js from osgjs
                url = url;
                console.log( url );
                var image = new osg.Image();
                image.setURL( url );
                return image;
            };

            // zorks on newer osgjs files only
            opts.readImageURL = createReadImageURLFunction;

            var createReadBinaryArrayURLFunction = function ( url, options ) {
                // here we are in the context of Input.js from osgjs
                url = 'models/' + url + '.gz';

                var defer2 = Q.defer();
                var dataProxyLoader2 = new XMLHttpRequest();

                dataProxyLoader2.addEventListener( 'load', function () {
                    var arrayBuffer = dataProxyLoader2.response;
                    if ( arrayBuffer ) {
                        defer2.resolve( arrayBuffer );
                    }
                    else {
                        defer2.reject();
                    }
                }, false );

                dataProxyLoader2.open( 'GET', url, true );
                dataProxyLoader2.responseType = 'arraybuffer';
                dataProxyLoader2.send();

                return defer2.promise;
            };
            opts.readBinaryArrayURL = createReadBinaryArrayURLFunction;
            if ( !NodeModel ) return;
            var promise = osgDB.parseSceneGraph( NodeModel, opts );

            Q.when( promise )
                .then( function ( child ) {
                    rootModelNode.removeChildren();
                    rootModelNode.addChild( child );

                    cbFocusCamera();

                    var target = child;

                    myStateSet = target.getOrCreateStateSet();
                    updateShader();
                    console.log( 'success ' );
                    if ( jsonp ) {
                        document.body.removeChild( dataProxyLoader );
                    }

                } );

        };

        var loadModel = function ( url ) {

            if ( jsonp ) {
                console.log( 'loading jsonp ' + url );
                dataProxyLoader = document.createElement( 'script' );
                dataProxyLoader.onload = function () {
                    switch ( modelName ) {
                    case 'mickey':
                        NodeModel = getModel();
                        break;
                    case 'pokerscene':
                        NodeModel = getPokerScene();
                        break;
                    case 'ogre':
                        NodeModel = getOgre();
                        break;
                    }
                    console.log( 'parse jsonp ' + url );
                    parseModel();
                };
                dataProxyLoader.onerror = function ( ) {
                    osg.log( 'error ' + url );
                };

                dataProxyLoader.type = 'text/javascript';
                dataProxyLoader.src = url;
                document.body.appendChild( dataProxyLoader );
            }
            else {
                console.log( 'loading XMLHttpRequest ' + url );
                dataProxyLoader = new XMLHttpRequest();
                dataProxyLoader.onreadystatechange = function () {
                    if ( dataProxyLoader.readyState === 4 ) {
                        if ( dataProxyLoader.status === 200 ) {
                            var response = dataProxyLoader.responseText;
                            NodeModel = JSON.parse( response );
                            console.log( 'parse json ' + url );
                            parseModel();
                        }
                    }
                    // console.log('Error', dataProxyLoader.statusText, dataProxyLoader.status, dataProxyLoader.readyState);

                };
                dataProxyLoader.open( 'GET', url, true );
                dataProxyLoader.send();
            }


        };
        console.log( 'osgjs loading: ' + modelName );
        loadModel( urlModel );
        return rootModelNode;
    }

    function createScene() {
        var scene = new osg.Node();

        getModelJson( 'materialTest', cbFocusCamera );

        scene.addChild( rootModelNode );

        return scene;
    }
    var fragShader;
    var vertShader;

    function loadShader( shaderFile ) {
        var shaderProxyLoader = new XMLHttpRequest();
        //shaderProxyLoader.responseType = 'text';
        shaderProxyLoader.open( 'GET', shaderFile + '?ran=' + Math.random(), false );
        shaderProxyLoader.send();

        if ( shaderProxyLoader.readyState === 4 ) {
            if ( shaderProxyLoader.status === 200 ) {
                var response = shaderProxyLoader.responseText;
                return response;
            }
        }
        return 'NO SHADER';
    }

    var reload = true;

    if ( !reload ) {
        fragShader = loadShader( 'shaders/pbr.frag' );
        vertShader = loadShader( 'shaders/pbr.vert' );
    }

  function getShader() {
      if ( reload ) {
        fragShader = loadShader( 'shaders/pbr.frag' );
        vertShader = loadShader( 'shaders/pbr.vert' );
      }
      var currentDefine = '';
    currentDefine += '#define WITH_NORMALMAP_UNSIGNED 1\n';
      currentDefine += '#define ' + pbrGui.metallicSpecularDefine + ' 1\n';
      currentDefine += '#define NDF_' + pbrGui.normalDistributionDefine + ' 1\n';
      currentDefine += '#define FRESNEL_' + pbrGui.fresnelDefine + ' 1\n';
      currentDefine += '#define GEOMETRY_' + pbrGui.geometryDefine + ' 1 \n';
      currentDefine += '#define EnergyRatio_' + pbrGui.energyRatioDefine + ' 1 \n';
    currentDefine += '#define USE_' + pbrGui.roughnessGlossinessDefine + ' 1 \n';
    currentDefine += '#define USE_' + pbrGui.specAA + ' 1 \n';

      switch (pbrGui.Precision){
        case 'HIGH':
        currentDefine += 'precision highp float;\n';
        break;
        case 'MEDIUM':
        currentDefine += 'precision mediump float;\n';
        break;
        case 'LOW':
        currentDefine += 'precision lowp float;\n';
        break;
     }


        if ( pbrGui.DiffuseMap !== 'NONE' ) {
            currentDefine += '#define USE_DIFFUSE_MAP 1 \n';
            myStateSet.addUniform( DiffuseMapUniform );
        }
        if ( pbrGui.RoughnessMap !== 'NONE' ) {
            currentDefine += '#define USE_ROUGNESS_MAP 1 \n';
            myStateSet.addUniform( RoughnessMapUniform );
        }
        if ( pbrGui.MetallicMap !== 'NONE' ) {
            currentDefine += '#define USE_METALLIC_MAP 1 \n';
            myStateSet.addUniform( MetallicMapUniform );
        }
        if ( pbrGui.NormalMap !== 'NONE' ) {
            currentDefine += '#define USE_NORMAL_MAP 1 \n';
            myStateSet.addUniform( NormalMapUniform );
        }
    if ( pbrGui.EnvMap !== 'NONE' ) {
          currentDefine += '#define USE_ENV_MAP 1 \n';
          myStateSet.addUniform(osg.Uniform.createInt1(4, 'Texture4'));
          myStateSet.addUniform(osg.Uniform.createInt1(5, 'Texture5'));
        }

        var vertexshader = currentDefine + vertShader;
        var fragmentshader = currentDefine + fragShader;

        var program = new osg.Program(
            new osg.Shader( 'VERTEX_SHADER', vertexshader ),
            new osg.Shader( 'FRAGMENT_SHADER', fragmentshader ) );


        return program;
    }
// copy paste from dat.gui save mechanism
var presets = {"preset":"Default","remembered":{"Default":{"0":{}},"Gun":{"0":{"model":"gun","Precision":"HIGH","Albedo":[255,200,200,1],"Specular":[0,200,200,1],"Roughness":0.7000000000000001,"Dielectric":0.6000000000000001,"lightColor":[255,255,255,1],"lightIntensity":1,"gamma":2.2,"metallicSpecularDefine":"METALLIC","normalDistributionDefine":"GGX","fresnelDefine":"SCHLICK","geometryDefine":"SMITH_SCHLICK_GGX","energyRatioDefine":"FresnelDiff","roughnessGlossinessDefine":"ROUGHNESS","specAA":"TOKSVIG","DiffuseMap":"CERBERUS","NormalMap":"CERBERUS","RoughnessMap":"CERBERUS","MetallicMap":"CERBERUS","EnvMap":"GrandCanyon_C_YumaPoint"}},"MarbleTest":{"0":{"model":"materialTest","Precision":"HIGH","Albedo":[220,17.254901960784323,17.254901960784323,1],"Specular":[0,200,200,1],"Roughness":0.7000000000000001,"Dielectric":0.6000000000000001,"lightColor":[232.5,225.79584775086502,118.52941176470587,1],"lightIntensity":0.4,"gamma":2.4000000000000004,"metallicSpecularDefine":"METALLIC","normalDistributionDefine":"GGX","fresnelDefine":"SCHLICK","geometryDefine":"SMITH_SCHLICK_GGX","energyRatioDefine":"FresnelDiff","roughnessGlossinessDefine":"ROUGHNESS","specAA":"TOKSVIG","DiffuseMap":"BASE","NormalMap":"BASE","RoughnessMap":"BASE","MetallicMap":"BASE","EnvMap":"Alexs_Apartment"}},"ogre":{"0":{"model":"ogre","Precision":"HIGH","Albedo":[11.176470588235297,95,0,1],"Specular":"#94a03a","Roughness":0.7000000000000001,"Dielectric":0.4,"lightColor":[232.5,225.79584775086502,118.52941176470587,1],"lightIntensity":0.4,"gamma":2.4000000000000004,"metallicSpecularDefine":"SPECULAR","normalDistributionDefine":"BLINNPHONG","fresnelDefine":"SCHLICK","geometryDefine":"SMITH_SCHLICK_GGX","energyRatioDefine":"FresnelDiff","roughnessGlossinessDefine":"ROUGHNESS","specAA":"TOKSVIG","DiffuseMap":"NONE","NormalMap":"NONE","RoughnessMap":"NONE","MetallicMap":"NONE","EnvMap":"Arches_E_PineTree"}}},"closed":false,"folders":{"Colors":{"preset":"Default","closed":false,"folders":{}},"PBR":{"preset":"Default","closed":false,"folders":{}},"light":{"preset":"Default","closed":false,"folders":{}},"Equations":{"preset":"Default","closed":false,"folders":{}},"Texture":{"preset":"Default","closed":false,"folders":{}}}};


    var gui = new dat.GUI({load: presets});

    // setup GUI
    gui.add( pbrGui, 'model', [ 'materialTest', 'pokerscene', 'ogre', 'raceship', 'gun' ] )
        .onChange( getModelJson );
    var f1 = gui.addFolder('Colors');
    f1.addColor( pbrGui, 'Albedo' )
        .onChange( update );
    f1.addColor( pbrGui, 'Specular' )
        .onChange( update );

    var f2 = gui.addFolder('PBR');

    f2.add( pbrGui, 'Roughness', 0.0, 1.0 )
        .step( 0.1 )
        .onChange( update );
    f2.add( pbrGui, 'Dielectric', 0.0, 1.0 )
        .step( 0.1 )
        .onChange( update );

    var f3 = gui.addFolder('light');

    f3.addColor( pbrGui, 'lightColor' )
        .onChange( update );
    f3.add( pbrGui, 'lightIntensity', 0.0, 5.0 )
        .step( 0.1 )
        .onChange( update );
    f3.add( pbrGui, 'gamma', 0.0, 5.0 )
        .step( 0.1 )
        .onChange( update );

  var f4 = gui.addFolder('Equations');

    f4.add( pbrGui, 'metallicSpecularDefine', [ 'METALLIC', 'SPECULAR' ] )
        .onChange( updateShader );
    f4.add( pbrGui, 'normalDistributionDefine', [ 'GGX', 'BLINNPHONG', 'BECKMANN' ] )
        .onChange( updateShader );
    f4.add( pbrGui, 'fresnelDefine', [ 'NONE', 'SCHLICK', 'COOKTORRANCE' ] )
        .onChange( updateShader );
    f4.add( pbrGui, 'geometryDefine', [ 'IMPLICIT', 'NEUMANN', 'WALTER', 'COOKTORRANCE', 'KELEMEN', 'SMITH_BECKMANN', 'SMITH_GGX', 'SMITH_SCHLICK_GGX', 'SCHLICK' ] )
        .onChange( updateShader );

    f4.add( pbrGui, 'energyRatioDefine', [ 'NONE', 'PI', 'FresnelDiff', 'FresnelSpec' ] )
        .onChange( updateShader );
    f4.add( pbrGui, 'roughnessGlossinessDefine', [ 'ROUGHNESS', 'GLOSSINESS' ] )
        .onChange( updateShader );

    f4.add( pbrGui, 'specAA', [ 'NONE', 'TOKSVIG' ] )
        .onChange( updateShader );



  var f5 = gui.addFolder('Texture');

    f5.add( pbrGui, 'DiffuseMap', [ 'NONE', 'BASE', 'CERBERUS' ] )
        .onChange( updateShader );
    f5.add( pbrGui, 'NormalMap', [ 'NONE', 'BASE', 'CERBERUS' ] )
        .onChange( updateShader );
    f5.add( pbrGui, 'RoughnessMap', [ 'NONE', 'BASE', 'CERBERUS' ] )
        .onChange( updateShader );
    f5.add( pbrGui, 'MetallicMap', [ 'NONE', 'BASE', 'CERBERUS' ] )
        .onChange( updateShader );
    f5.add( pbrGui, 'EnvMap', [ 'NONE', 'Alexs_Apartment', 'Arches_E_PineTree', 'GrandCanyon_C_YumaPoint', 'Milkyway', 'Walk_Of_Fame' ] )
        .onChange( updateShader );



    gui.add( pbrGui, 'Precision', [ 'HIGH', 'MEDIUM', 'LOW' ] )
        .onChange( updateShader );

    gui.add( pbrGui, 'reload' );

    gui.remember( pbrGui );



    // The 3D canvas.
    var canvas = document.getElementById( '3DView' );
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // The viewer
    viewer = new osgViewer.Viewer( canvas, {
        antialias: true,
        alpha: true
    } );
    viewer.init();
    viewer.getCamera()
        .setClearColor( [ 0.3, 0.3, 0.3, 0.3 ] );

    if ( !viewer.getWebGLCaps()._webGLExtensions.OES_standard_derivatives ) {
        alert( 'need derivatives, man!' );
    }
    var root = createScene( cbFocusCamera );


    var size = 500;
    background = getEnvSphere(size, root);
    background.getOrCreateStateSet().addUniform(exposure);
    background.getOrCreateStateSet().addUniform(gamma);

    setEnvironment('Milkyway');

    //root.addChild(background);

    viewer.setSceneData( root );

    viewer.setupManipulator();
    viewer.run();

};

window.addEventListener( 'load', main, true );
