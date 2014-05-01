/*global osg:false,  OSG :false, osgViewer: false, getTexture: false, dat: false, getModelJson: false, presets: false, loadShader: false, setEnvironment: false, getEnvSphere: false*/

var main = function () {

    // from require to global var
    OSG.globalify();


    var viewer;
    var textureHigh;
    var textureEnv;
    var textureHighBlur;
    var background;
    var fragShader;
    var vertShader;
    var reload = true;
    var myStateSet;

    var textureSet = {};
    // the light itself
    var lightNode;
    var lightNew;

    var rootModelNode = new osg.MatrixTransform();
    rootModelNode.setMatrix( osg.Matrix.makeRotate( -Math.PI / 2, 1, 0, 0, [] ) );


    var cbFocusCamera = function () {
        viewer.getManipulator()
            .computeHomePosition();
    };

    var callBackLoaded = function ( model ) {
        rootModelNode.removeChildren();
        rootModelNode.addChild( model );
        cbFocusCamera();
        myStateSet = model.getOrCreateStateSet();

        reload = true;
        updateShader();

    };

    var Albedo = osg.Uniform.createFloat4( [ 0.5, 0.0, 0.0, 1.0 ], 'Albedo' );
    var Specular = osg.Uniform.createFloat4( [ 0.0, 0.7, 0.0, 1.0 ], 'Specular' );
    var Metallic = osg.Uniform.createFloat( 0.1, 'Metallic' );
    var Roughness = osg.Uniform.createFloat( 0.1, 'Roughness' );
    var lightIntensity = osg.Uniform.createFloat( 0.1, 'LightIntensity' );
    var lightAmbientIntensity = osg.Uniform.createFloat( 0.05, 'LightAmbientIntensity' );
    var lightColor = osg.Uniform.createFloat4( [ 1.0, 1.0, 1.0, 1.0 ], 'LightColor' );
    var gamma = osg.Uniform.createFloat( 2.2, 'Gamma' );
    var exposure = osg.Uniform.createFloat1( 0.0, 'Exposure' );

    var DiffuseMapUniform = osg.Uniform.createInt( 0, 'Texture0' );
    var RoughnessMapUniform = osg.Uniform.createInt( 1, 'Texture1' );
    var MetallicMapUniform = osg.Uniform.createInt( 2, 'Texture2' );
    var NormalMapUniform = osg.Uniform.createInt( 3, 'Texture3' );

    var currentChannelTexture = new Array(16);
    var updateTexture = function () {

        if ( reload || currentChannelTexture[0] !== pbrGui.DiffuseMap ){
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

            default:
                myStateSet.setTextureAttributeAndMode( 0, getTexture( pbrGui.DiffuseMap ), osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
                break;
            }
            currentChannelTexture[0] = pbrGui.DiffuseMap;
        }

        if (  reload ||  currentChannelTexture[1] !== pbrGui.RoughnessMap ){
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

            default:
                myStateSet.setTextureAttributeAndMode( 1, getTexture( pbrGui.RoughnessMap ), osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
                break;
            }
            currentChannelTexture[1] = pbrGui.RoughnessMap;
        }


        if ( reload || currentChannelTexture[2] !== pbrGui.MetallicMap ){
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
            default:
                myStateSet.setTextureAttributeAndMode( 2, getTexture( pbrGui.MetallicMap ), osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            }
            currentChannelTexture[2] = pbrGui.MetallicMap;
        }

        if ( reload || currentChannelTexture[3] !== pbrGui.NormalMap ){

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
            default:
                myStateSet.setTextureAttributeAndMode( 3, getTexture( pbrGui.NormalMap ), osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );        break;
            }
            currentChannelTexture[3] = pbrGui.NormalMap;
        }

        if ( reload || currentChannelTexture[4] !== pbrGui.EnvMap ){
            switch ( pbrGui.EnvMap ) {
            case 'NONE':
                myStateSet.removeTextureAttribute( 4, undefined, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
                myStateSet.removeTextureAttribute( 5, undefined, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
                break;
            default:
                setEnvironment( pbrGui.EnvMap, myStateSet, textureEnv, textureHigh, textureHighBlur, background );
                break;
            }
            currentChannelTexture[4] = pbrGui.EnvMap;
        }
    };

    var updateShader = function () {
        updateTexture();

        myStateSet.setAttributeAndMode( getShader() );

        myStateSet.addUniform( Albedo );
        myStateSet.addUniform( Specular );
        myStateSet.addUniform( Metallic );
        myStateSet.addUniform( Specular );
        myStateSet.addUniform( Roughness );
        myStateSet.addUniform( lightIntensity );
        myStateSet.addUniform( lightAmbientIntensity );
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
        this.lightAmbientIntensity = 0.01;
        this.gamma = 2.2;
        this.exposure = 0.0001;
        this.lightColor = [ 255.0, 255.0, 255.0, 1.0 ];
        this.equationDefine = 'EDIT_MODE';
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
        this.specAA = 'NONE';
        this.reload = function () {
            reload = true;
            updateShader();
        };
        this.Precision = 'HIGH';
    };

    var pbrGui = new GUIPARAMS();

    var update = function () {
        // This is calculated each time;
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
        lightAmbientIntensity.set( pbrGui.lightAmbientIntensity );

        gamma.set( pbrGui.gamma );
        exposure.set( pbrGui.exposure );

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

    function createScene() {
        var scene = new osg.Node();

        getModelJson( 'materialTest', rootModelNode, callBackLoaded, textureSet, pbrGui );

        scene.addChild( rootModelNode );

        return scene;
    }


    //fragShader = loadShader( 'shaders/pbr.frag' );
    vertShader = loadShader( 'shaders/pbr.vert' );
    //faster back&forth not needing recompiling.
    var programCache = [];
    var vertexShaderCache = [];
    var fragmentShaderCache = [];

    function getShader() {
        if ( reload ) {
            fragShader = loadShader( 'shaders/pbr.frag' );
            //vertShader = loadShader( 'shaders/pbr.vert' );
            reload = false;
        }
        var currentDefine = '';

        switch ( pbrGui.Precision ) {
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

        var vertexshader = currentDefine + vertShader;

        //currentDefine += '#define WITH_NORMALMAP_UNSIGNED 1\n';
        currentDefine += '#define EQUATION_' + pbrGui.equationDefine + ' 1\n';
        currentDefine += '#define ' + pbrGui.metallicSpecularDefine + ' 1\n';
        currentDefine += '#define NDF_' + pbrGui.normalDistributionDefine + ' 1\n';
        currentDefine += '#define FRESNEL_' + pbrGui.fresnelDefine + ' 1\n';
        currentDefine += '#define GEOMETRY_' + pbrGui.geometryDefine + ' 1 \n';
        currentDefine += '#define EnergyRatio_' + pbrGui.energyRatioDefine + ' 1 \n';
        currentDefine += '#define USE_' + pbrGui.roughnessGlossinessDefine + ' 1 \n';
        currentDefine += '#define USE_' + pbrGui.specAA + ' 1 \n';

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
            myStateSet.addUniform( osg.Uniform.createInt1( 4, 'Texture4' ) );
            myStateSet.addUniform( osg.Uniform.createInt1( 5, 'Texture5' ) );
            myStateSet.addUniform( osg.Uniform.createInt1( 6, 'Texture6' ) );
        }

        var fragmentshader = currentDefine + fragShader;

        var vertexShaderObj = null;
        vertexShaderCache.forEach( function ( cached ) {
            if ( cached.text === vertexshader ) {
                vertexShaderObj = cached.shader;
                return;
            }
        } );

        var fragmentShaderObj = null;
        fragmentShaderCache.forEach( function ( cached ) {
            if ( cached.text === fragmentshader ) {
                fragmentShaderObj = cached.shader;
                return;
            }
        } );

        // better index than whole text here...
        var shaderText = vertexshader + fragmentshader;
        var programObj;
        if ( fragmentShaderObj && vertexShaderObj ) {

            programCache.forEach( function ( cachedProgram ) {
                if ( cachedProgram.text === shaderText ) {
                    programObj = cachedProgram.program;
                    return;
                }
            } );
        }
        if ( programObj )
            return programObj;

        // Not in cache
        if ( !vertexShaderObj ) {
            vertexShaderObj = new osg.Shader( 'VERTEX_SHADER', vertexshader );
            vertexShaderCache.push( {
                text: vertexshader,
                shader: vertexShaderObj
            } );
        }

        if ( !fragmentShaderObj ) {
            fragmentShaderObj = new osg.Shader( 'FRAGMENT_SHADER', fragmentshader );
            fragmentShaderCache.push( {
                text: fragmentshader,
                shader: fragmentShaderObj
            } );

        }


        programObj = new osg.Program( vertexShaderObj, fragmentShaderObj );

        programCache.push( {
            text: shaderText,
            program: programObj
        } );



        programObj.trackAttributes = {};
        programObj.trackAttributes.attributeKeys = [];
        programObj.trackAttributes.attributeKeys.push('Material');
        programObj.trackAttributes.attributeKeys.push('Light0');

        return programObj;
    }

    var gui = new dat.GUI( {
        load: presets
    } );

    // setup GUI
    gui.add( pbrGui, 'model', [ 'materialTest', 'plane', 'sphere', 'cube',  'pokerscene', 'ogre', 'gun', 'perry', 'dragon', 'bunny', 'buddha', 'sponza', 'teapot' ] )
        .onChange( function ( value ) {
            textureSet = {};
            var newSimpleGeom;
            switch(value){
            case 'plane':
                var QuadSizeX = 100;
                var QuadSizeY = QuadSizeX*9/16.0;
                newSimpleGeom = osg.createTexturedQuadGeometry(-QuadSizeX/2.0, -QuadSizeY/2.0,0,
                                                                  QuadSizeX, 0 ,0,
                                                                  0, QuadSizeY,0);
                break;
            case 'sphere':
                newSimpleGeom = osg.createTexturedSphere( 10, 30, 30 );
                break;
            case 'cube':
                var sizeBox = 5;
                newSimpleGeom = osg.createTexturedBoxGeometry(0, 0, 0, sizeBox, sizeBox, sizeBox);
                break;
            }
            if (newSimpleGeom){
                callBackLoaded(newSimpleGeom);
                return;
            }
            getModelJson( value, rootModelNode, callBackLoaded, textureSet, pbrGui );
        } );
    var f1 = gui.addFolder( 'Colors' );
    f1.addColor( pbrGui, 'Albedo' )
        .onChange( update );
    f1.addColor( pbrGui, 'Specular' )
        .onChange( update );

    var f2 = gui.addFolder( 'PBR' );

    f2.add( pbrGui, 'Roughness', 0.0, 1.0 )
        .step( 0.1 )
        .onChange( update );
    f2.add( pbrGui, 'Dielectric', 0.0, 1.0 )
        .step( 0.1 )
        .onChange( update );

    var f3 = gui.addFolder( 'light' );

    f3.addColor( pbrGui, 'lightColor' )
        .onChange( update );
    f3.add( pbrGui, 'lightIntensity', 0.0, 10.0 )
        .step( 0.1 )
        .onChange( update );
    f3.add( pbrGui, 'lightAmbientIntensity', 0.0, 1.0 )
        .step( 0.1 )
        .onChange( update );
    f3.add( pbrGui, 'gamma', 0.0, 5.0 )
        .step( 0.1 )
        .onChange( update );
    f3.add( pbrGui, 'exposure', 0.0, 1.0 )
        .step( 0.1 )
        .onChange( update );

    var f4 = gui.addFolder( 'Equations' );

    f4.add( pbrGui, 'equationDefine', [ 'EDIT_MODE', 'GGX_3', 'COOK_TORRANCE', 'GGX_REF', 'GGX_1', 'GGX_2', 'DOTNL' ] )
        .onChange( updateShader );
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



    var f5 = gui.addFolder( 'Texture' );

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
    background = getEnvSphere( size, root, viewer );
    //uniform shared by all shaders
    background.getOrCreateStateSet()
        .addUniform( exposure );
    background.getOrCreateStateSet()
        .addUniform( gamma );

    setEnvironment( 'Milkyway', myStateSet, textureHigh, textureEnv, textureHighBlur, background );

// the light itself
    lightNode = new osg.LightSource();
    lightNew = new osg.Light();
   // mainNode.setUpdateCallback(new LightUpdateCallback());
    root.light = lightNew;
    lightNode.setLight(lightNew);

    root.getOrCreateStateSet().setAttributeAndMode(lightNew, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE);

    root.addChild(lightNode);
    viewer.setLight(lightNew);

    viewer.setSceneData( root );

    viewer.setupManipulator();

    viewer.run();

};

window.addEventListener( 'load', main, true );
