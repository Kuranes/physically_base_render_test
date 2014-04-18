// from require to global var
OSG.globalify();

// shader in separate file from source
// better code, allow for reload
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
// specialized hdre image reader
function readImageURL( url ) {
    var ext = url.split( '.' )
        .pop();
    if ( ext == "hdr" )
        return osg.readHDRImage( url );

    return osgDB.readImageURL( url );
}
function base64ArrayBuffer(arrayBuffer) {
  var base64    = ''
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  var bytes         = new Uint8Array(arrayBuffer)
  var byteLength    = bytes.byteLength
  var byteRemainder = byteLength % 3
  var mainLength    = byteLength - byteRemainder

  var a, b, c, d
  var chunk

  // Main loop deals with bytes in chunks of 3
  for (var i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048)   >> 12 // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032)     >>  6 // 4032     = (2^6 - 1) << 6
    d = chunk & 63               // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder == 1) {
    chunk = bytes[mainLength]

    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3)   << 4 // 3   = 2^2 - 1

    base64 += encodings[a] + encodings[b] + '=='
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008)  >>  4 // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15)    <<  2 // 15    = 2^4 - 1

    base64 += encodings[a] + encodings[b] + encodings[c] + '='
  }

  return base64;
}
// Cache image once loaded
// faster reload
// hacky preload image
var preLoadImgUrl = [ 'textures/Albedo.png',
                      'textures/Cerberus_A.png',
                      'textures/Roughness.png',
                      'textures/Cerberus_R.png',
                      'textures/Metallic.png',
                      'textures/Cerberus_M.png',
                      'textures/Normal.png',
                      'textures/Cerberus_N.png'
                    ];

var preLoadImg = {};

var loadCacheImage = function( urlImg ){
     var xhrLoad = false;

    var img = new Image();
    if (!xhrLoad){
        img = new Image();
        img.src = urlImg;
    }
    else{
        var xhrImg = new XMLHttpRequest();
        xhrImg.addEventListener( 'load', function(e) {
            img.src= "data:image/png;base64," + base64ArrayBuffer(e.currentTarget.response);
        });
        xhrImg.open('GET', urlImg, true);
        xhrImg.responseType = 'arraybuffer';
        xhrImg.send();
    }

    preLoadImg[ urlImg ] = img;
}

// load and enable texture filters
var getTexture = function ( url ) {
    var texture;
    if ( !preLoadImg[ url ]   ) {
        loadCacheImage ( url );
    }

    texture = osg.Texture.createFromImage( preLoadImg[ url ] );

    texture.setMinFilter( osg.Texture.LINEAR_MIPMAP_LINEAR );
    texture.setMagFilter( osg.Texture.LINEAR );
    return texture;
}

// load models either json or jsonp
function getModelJson( modelName, rootModelNode, callBackLoaded ) {
        var urlModel;
        var jsonp = true;

        switch ( modelName ) {
        case 'pokerscene':
            urlModel = 'http://osgjs.org/examples/pokerscene/' + modelName + '.js';
            break;
        case 'ogre':
            urlModel = 'http://osgjs.org/examples/shadow/' + modelName + '.osgjs';
            break;
        default:
            urlModel = window.location.origin + window.location.pathname + 'models/' + modelName + '.osgjs';
            jsonp = false;
            break;
        }

        var NodeModel;
        var dataProxyLoader;


        var parseModel = function (rootModelNode, callBackLoaded) {

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
                    callBackLoaded( child );
                    console.log( 'success ' );
                    if ( jsonp ) {
                        document.body.removeChild( dataProxyLoader );
                    }

                } );

        };

        var loadModel = function ( url, rootModelNode, callBackLoaded ) {

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
                    parseModel(rootModelNode, callBackLoaded);
                };
                dataProxyLoader.onerror = function () {
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
                            parseModel(rootModelNode, callBackLoaded);
                        }
                    }
                    // console.log('Error', dataProxyLoader.statusText, dataProxyLoader.status, dataProxyLoader.readyState);

                };
                dataProxyLoader.open( 'GET', url, true );
                dataProxyLoader.send();
            }


        };
        console.log( 'osgjs loading: ' + modelName );
        loadModel( urlModel, rootModelNode, callBackLoaded);
        return rootModelNode;
    }

// read HDR image
function decodeHDRHeader( buf ) {
        var info = {
            exposure: 1.0
        };

        // find header size
        var size = -1,
            size2 = -1;
        for ( var i = 0; i < buf.length - 1; i++ ) {
            if ( buf[ i ] == 10 && buf[ i + 1 ] == 10 ) {
                size = i;
                break;
            }
        }
        for ( var i = size + 2; i < buf.length - 1; i++ ) {
            if ( buf[ i ] == 10 ) {
                size2 = i;
                break;
            }
        }

        // convert header from binary to text lines
        var header = String.fromCharCode.apply( null, new Uint8Array( buf.subarray( 0, size ) ) ); // header
        // is
        // in
        // text
        // format
        var lines = header.split( "\n" );
        if ( lines[ 0 ] != "#?RADIANCE" ) {
            console.error( "Invalid HDR image." );
            return false;
        }
        for ( var i = 0; i < lines.length; i++ ) {
            var line = lines[ i ];
            var matches = line.match( /(\w+)=(.*)/i );
            if ( matches != null ) {
                var key = matches[ 1 ],
                    value = matches[ 2 ];

                if ( key == "FORMAT" )
                    info.format = value;
                else if ( key == "EXPOSURE" )
                    info.exposure = parseFloat( value );
            }
        }

        // fill image resolution
        var line = String.fromCharCode.apply( null, new Uint8Array( buf.subarray( size + 2, size2 ) ) );
        var matches = line.match( /-Y (\d+) \+X (\d+)/ );
        info.width = parseInt( matches[ 2 ] );
        info.height = parseInt( matches[ 1 ] );
        info.scanline_width = parseInt( matches[ 2 ] );
        info.num_scanlines = parseInt( matches[ 1 ] );

        info.size = size2 + 1;
        return info;
    }

// Read a radiance .hdr file (http://radsite.lbl.gov/radiance/refer/filefmts.pdf)
// Ported from http://www.graphics.cornell.edu/~bjw/rgbe.html
osg.readHDRImage = function ( url, options ) {
    if ( options === undefined ) {
        options = {};
    }

    var img = {
        'data': null,
        'width': 0,
        'height': 0
    };

    // download .hdr file
    var xhr = new XMLHttpRequest();
    xhr.open( 'GET', url, true );
    xhr.responseType = "arraybuffer";

    var defer = Q.defer();
    xhr.onload = function ( ev ) {
        if ( xhr.response ) {
            var bytes = new Uint8Array( xhr.response );

            var header = decodeHDRHeader( bytes );
            if ( header == false )
                return;

            // initialize output buffer
            var data = new Uint8Array( header.width * header.height * 4 );
            var img_offset = 0;

            if ( ( header.scanline_width < 8 ) || ( header.scanline_width > 0x7fff ) ) {
                console.error( 'not rle compressed .hdr file' );
                return;
            }

            // read in each successive scanline
            var scanline_buffer = new Uint8Array( 4 * header.scanline_width );
            var read_offset = header.size;
            var num_scanlines = header.num_scanlines;
            while ( num_scanlines > 0 ) {
                var offset = 0;
                var rgbe = [ bytes[ read_offset++ ], bytes[ read_offset++ ], bytes[ read_offset++ ], bytes[ read_offset++ ] ];
                var buf = [ 0, 0 ];

                if ( ( rgbe[ 0 ] != 2 ) || ( rgbe[ 1 ] != 2 ) || ( rgbe[ 2 ] & 0x80 ) ) {
                    console.error( 'this file is not run length encoded' );
                    return;
                }

                if ( ( ( rgbe[ 2 ] ) << 8 | rgbe[ 3 ] ) != header.scanline_width ) {
                    console.error( 'wrong scanline width' );
                    return;
                }

                // read each of the four channels for the scanline into the buffer
                for ( var i = 0; i < 4; i++ ) {
                    var offset_end = ( i + 1 ) * header.scanline_width;
                    while ( offset < offset_end ) {
                        buf[ 0 ] = bytes[ read_offset++ ];
                        buf[ 1 ] = bytes[ read_offset++ ];

                        if ( buf[ 0 ] > 128 ) {
                            // a run of the same value
                            count = buf[ 0 ] - 128;
                            if ( ( count == 0 ) || ( count > offset_end - offset ) ) {
                                console.error( 'bad scanline data' );
                                return;
                            }
                            while ( count-- > 0 )
                                scanline_buffer[ offset++ ] = buf[ 1 ];
                        }
                        else {
                            // a non-run
                            count = buf[ 0 ];
                            if ( ( count == 0 ) || ( count > offset_end - offset ) ) {
                                console.error( 'bad scanline data' );
                                return;
                            }
                            scanline_buffer[ offset++ ] = buf[ 1 ];

                            if ( --count > 0 ) {
                                while ( count-- > 0 ) {
                                    scanline_buffer[ offset++ ] = bytes[ read_offset++ ];
                                }
                            }
                        }
                    }
                }

                // fill the image array
                for ( var i = 0; i < header.scanline_width; i++ ) {
                    data[ img_offset++ ] = scanline_buffer[ i ];
                    data[ img_offset++ ] = scanline_buffer[ i + header.scanline_width ];
                    data[ img_offset++ ] = scanline_buffer[ i + 2 * header.scanline_width ];
                    data[ img_offset++ ] = scanline_buffer[ i + 3 * header.scanline_width ];
                }

                num_scanlines--;
            }

            // send deferred info
            img.data = data;
            img.width = header.width;
            img.height = header.height;
            defer.resolve( img );
        }
    }

    // async/defer
    xhr.send( null );
    return defer.promise;
}


var SphereEnvMap = function ( viewer ) {
    this._viewer = viewer;
}




// create the fake env sphere geom and fake camera
function getEnvSphere( size, scene, viewer ) {
        // create the environment sphere
        //var geom = osg.createTexturedSphere(size, 32, 32);
        var geom = osg.createTexturedBoxGeometry( 0, 0, 0, size, size, size );
        geom.getOrCreateStateSet()
            .setAttributeAndModes( new osg.CullFace( 'DISABLE' ) );
        geom.getOrCreateStateSet()
            .setAttributeAndModes( getShaderBackground() );

        var cubemapTransform = osg.Uniform.createMatrix4( osg.Matrix.makeIdentity( [] ), "CubemapTransform" );
        var mt = new osg.MatrixTransform();
        mt.setMatrix( osg.Matrix.makeRotate( Math.PI / 2.0, 1, 0, 0, [] ) );
        mt.addChild( geom );
        var CullCallback = function () {
            this.cull = function ( node, nv ) {
                // overwrite matrix, remove translate so environment is always at camera origin
                osg.Matrix.setTrans( nv.getCurrentModelviewMatrix(), 0, 0, 0 );
                var m = nv.getCurrentModelviewMatrix();
                osg.Matrix.copy( m, cubemapTransform.get() );
                cubemapTransform.dirty();
                return true;
            }
        }
        mt.setCullCallback( new CullCallback() );
        scene.getOrCreateStateSet()
            .addUniform( cubemapTransform );

        var cam = new osg.Camera();
        cam.setReferenceFrame( osg.Transform.ABSOLUTE_RF );
        cam.addChild( mt );

        var self = this;
        // the update callback get exactly the same view of the camera
        // but configure the projection matrix to always be in a short znear/zfar range to not vary depend on the scene size
        var UpdateCallback = function ( viewer ) {
            this._viewer = viewer;
            this.update = function ( node, nv ) {
                var rootCam = this._viewer.getCamera();

                //rootCam.
                var info = {};
                osg.Matrix.getPerspective( rootCam.getProjectionMatrix(), info );
                var proj = [];
                osg.Matrix.makePerspective( info.fovy, info.aspectRatio, 1.0, 100.0, proj );
                cam.setProjectionMatrix( proj );
                cam.setViewMatrix( rootCam.getViewMatrix() );

                return true;
            };
        };
        cam.setUpdateCallback( new UpdateCallback( viewer ) );
        scene.addChild( cam );

        return geom;
    }

    function getShaderBackground() {

        var vertexshader = loadShader( 'shaders/envmap.vert' );
        var fragmentshader = loadShader( 'shaders/envmap.frag' );

        var program = new osg.Program(
            new osg.Shader( 'VERTEX_SHADER', vertexshader ),
            new osg.Shader( 'FRAGMENT_SHADER', fragmentshader ) );

        return program;
    }
// change the environment maps (reflective included)
// Images are 8-bit RGBE encoded based on the radiance file format
// The example supports radiance .hdr files, but uses .png which contains the exact same information for better size and speed.
function setEnvironment( name, myStateSet, textureEnv, textureHigh, background ) {
    var texturesEnvList = {
        'Alexs_Apartment': [ 'Alexs_Apt_2k.png', 'Alexs_Apt_Env.png' ],
        'Arches_E_PineTree': [ 'Arches_E_PineTree_3k.png', 'Arches_E_PineTree_Env.png' ],
        'GrandCanyon_C_YumaPoint': [ 'GCanyon_C_YumaPoint_3k.png', 'GCanyon_C_YumaPoint_Env.png' ],
        'Milkyway': [ 'Milkyway_small.png', 'Milkyway_Light.png' ],
        'Walk_Of_Fame': [ 'Mans_Outside_2k.png', 'Mans_Outside_Env.png' ]
    };
    var urls = texturesEnvList[ name ];

    Q.all( [
        readImageURL( 'textures/' + name + '/' + urls[ 0 ] ),
        readImageURL( 'textures/' + name + '/' + urls[ 1 ] ) ] )
        .then( function ( images ) {
            textureHigh = new osg.Texture();
            textureHigh.setImage( images[ 0 ] );
            if ( images[ 0 ].data ) {
                textureHigh.setTextureSize( images[ 0 ].width, images[ 0 ].height );
                textureHigh.setImage( images[ 0 ].data, osg.Texture.RGBA );
            }
            background.getOrCreateStateSet()
                .setTextureAttributeAndMode( 0, textureHigh );
            background.getOrCreateStateSet()
                .addUniform( osg.Uniform.createInt1( 0, 'Texture0' ) );

            textureEnv = new osg.Texture();
            textureEnv.setImage( images[ 1 ] );
            if ( images[ 0 ].data ) {
                textureEnv.setTextureSize( images[ 0 ].width, images[ 0 ].height );
                textureEnv.setImage( images[ 0 ].data, osg.Texture.RGBA );
            }
            if ( myStateSet ) {
                myStateSet.setTextureAttributeAndMode( 4, textureHigh, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
                myStateSet.setTextureAttributeAndMode( 5, textureEnv, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            }
        } );
}
