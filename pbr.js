/*global osg:false,  OSG :false, osgViewer: false, osgDB: false, Q: false, dat: false*/

var main = function () {

    // from require to global var
    OSG.globalify();


    var viewer;
    var textureHigh;
    var textureEnv;
    var background;
    var fragShader;
    var vertShader;
    var reload = true;
    var myStateSet;


    var rootModelNode = new osg.MatrixTransform();
    rootModelNode.setMatrix( osg.Matrix.makeRotate( -Math.PI / 2, 1, 0, 0, [] ) );


    var cbFocusCamera = function () {
        viewer.getManipulator()
            .computeHomePosition();
    };

    var callBackLoaded = function (model){
        rootModelNode.removeChildren();
        rootModelNode.addChild( model );
        cbFocusCamera();
        myStateSet = model.getOrCreateStateSet();
        updateShader();
    }

    var Albedo = osg.Uniform.createFloat4( [ 0.5, 0.0, 0.0, 1.0 ], 'Albedo' );
    var Specular = osg.Uniform.createFloat4( [ 0.0, 0.7, 0.0, 1.0 ], 'Specular' );
    var Metallic = osg.Uniform.createFloat( 0.1, 'Metallic' );
    var Roughness = osg.Uniform.createFloat( 0.1, 'Roughness' );
    var lightIntensity = osg.Uniform.createFloat( 0.1, 'LightIntensity' );
    var lightColor = osg.Uniform.createFloat4( [ 1.0, 1.0, 1.0, 1.0 ], 'LightColor' );
    var gamma = osg.Uniform.createFloat( 2.2, 'Gamma' );
    var exposure = osg.Uniform.createFloat1( 0.0, 'Exposure' );

    var DiffuseMapUniform = osg.Uniform.createInt( 0, 'Texture0' );
    var RoughnessMapUniform = osg.Uniform.createInt( 1, 'Texture1' );
    var MetallicMapUniform = osg.Uniform.createInt( 2, 'Texture2' );
    var NormalMapUniform = osg.Uniform.createInt( 3, 'Texture3' );

    var updateTexture = function () {

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
            myStateSet.removeTextureAttribute( 4, undefined, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            myStateSet.removeTextureAttribute( 5, undefined, osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE );
            break;
        default:
            setEnvironment( pbrGui.EnvMap, myStateSet, textureEnv, textureHigh, background );
            break;
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
        this.exposure = 0.0
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
        this.reload = function (){ reload = true; updateShader(); };
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

        getModelJson( 'materialTest', rootModelNode, callBackLoaded );

        scene.addChild( rootModelNode );

        return scene;
    }


    fragShader = loadShader( 'shaders/pbr.frag' );
    vertShader = loadShader( 'shaders/pbr.vert' );

    function getShader() {
        if ( reload ) {
            fragShader = loadShader( 'shaders/pbr.frag' );
            vertShader = loadShader( 'shaders/pbr.vert' );
            reload = false;
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
        }

        var vertexshader = currentDefine + vertShader;
        var fragmentshader = currentDefine + fragShader;

        var program = new osg.Program(
            new osg.Shader( 'VERTEX_SHADER', vertexshader ),
            new osg.Shader( 'FRAGMENT_SHADER', fragmentshader ) );


        return program;
    };

    var gui = new dat.GUI( {
        load: presets
    } );

    // setup GUI
    gui.add( pbrGui, 'model', [ 'materialTest', 'pokerscene', 'ogre',  'gun' ] )
        .onChange( function(value){ getModelJson(value, rootModelNode, callBackLoaded); } );
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
    f3.add( pbrGui, 'lightIntensity', 0.0, 5.0 )
        .step( 0.1 )
        .onChange( update );
    f3.add( pbrGui, 'gamma', 0.0, 5.0 )
        .step( 0.1 )
        .onChange( update );
    f3.add( pbrGui, 'exposure', -2.0, 2.0 )
        .step( 0.1 )
        .onChange( update );

    var f4 = gui.addFolder( 'Equations' );

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

    if ( !viewer.getWebGLCaps()
        ._webGLExtensions.OES_standard_derivatives ) {
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

    setEnvironment( 'Milkyway', myStateSet, textureEnv, textureHigh, background );

    viewer.setSceneData( root );

    viewer.setupManipulator();
    viewer.run();

};

window.addEventListener( 'load', main, true );
