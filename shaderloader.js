//
//     Manage External Load Shader
//     Or storage as json inside code
//     (like concatened from shader file
//     to json using a build tool like grunt)
//     TODO: tests load/reload shaders for realtime editing.
//
//     Idea is to be able to edit shader in separate files than js, getting readable code, and avoid string/shader duplication in code, resulting in min code.
//     Handle loading shader files using ajax,json,jsonp or  even inline, with a grunt dir2json task that will generate according files.
//     Handle (recursive) include, avoiding code repeat and help code factorization
//     Handle per shader and global define (upon extension supported, hw capabilites ("highp precision") or shader usage ("LAMBERT or BLINN_PHONG").)
//     Possible afterward Todo list:
//     a shader/program cache
//     use glsl optimizer on shaders
//     use glsl minimizer on shaders.
/**
 * @class ShaderLoader
 */
osg.ShaderLoader = function(options) {
    this.init(options);
};

/** @lends osg.ShaderLoader.prototype */
osg.ShaderLoader.prototype = osg.objectLibraryClass({
    _shadersText: {},
    _shadersObject: {},
    _shadersList: {},
    _shaderLoaded: {},
    _loaded: false,
    _callbackSingle: false,
    _callbackAll: false,
    _async: true,
    _numtoLoad: 0,
    _globalDefaultDefines: '',
    _globalDefaultprecision: '#ifdef GL_FRAGMENT_PRECISION_HIGH\n precision highp float;\n #else\n precision mediump float;\n#endif',
    _debugLines: false,
    _includeR: /#pragma include "([^"]+)"/g,
    _uniformR: /uniform\s+([a-z]+\s+)?([A-Za-z0-9]+)\s+([a-zA-Z_0-9]+)\s*(\[\s*(.+)\s*\])?/,
    _structR: /struct\s+\w+\s*\{[^\}]+\}\s*;/g,
    _structExtractR: /struct\s+(\w+)\s*\{([^\}]+)\}\s*;/,
    _structFieldsR: /[^;]+;/g,
    _structFieldR: /\s*([a-z]+\s+)?([A-Za-z0-9]+)\s+([a-zA-Z_0-9]+)\s*(\[\s*(.+)\s*\])?\s*;/,
    _defineR: /#define\s+([a-zA-Z_0-9]+)\s+(.*)/,
    _precisionR: /precision\s+(high|low|medium)p\s+float/,
    init: function(options) {
        var shader;
        this._callbackAll = options.callbackAll;
        this._callbackSingle = options.callbackSingle;
        this._async = options.async;
        this._numtoLoad = 0;
        if (!options.loadprefix) options.loadprefix = '';
        var i;
        for (i in options.shaders) {
            if (options.shaders.hasOwnProperty(i)) {
                this._numtoLoad++;
            }
        }
        if (!options.inline) {
            for (i in options.shaders) {
                if (options.shaders.hasOwnProperty(i)) {
                    this._shadersList[i] = options.loadprefix + i;
                }
            }
            this._loaded = false;
        } else {
            for (i in options.shaders) {
                if (options.shaders.hasOwnProperty(i)) {
                    this._shadersList[i] = i;
                    this._shadersText[i] = options.shaders[i];
                    if (this._callbackSingle) this._callbackSingle(i);
                    this._numtoLoad--;
                }
            }
            this._loaded = true;

            console.assert(this._numtoLoad === 0);
            if (this._callbackAll) this._callbackAll();
        }
        return this;
    },
    loadCallBack: function(e) {
        if (e.target.status === 200) {
            //console.log(e);
            this._shadersText[e.target.shaderName] = e.target.responseText;
            if (this._callbackSingle) this._callbackSingle();
            this._numtoLoad--;
            if (this._numtoLoad === 0 && this._callbackAll) this._callbackAll();
        }
    },
    load: function(shaderFilename, shaderName, callbackSingle) {
        if (!this._shadersList[shaderName]) this._shadersList[shaderName] = shaderFilename;

        var loader;

        req = new XMLHttpRequest();
        req.shaderName = shaderName;
        req.open("GET", shaderFilename, this._async);
        req.addEventListener("load", this.loadCallBack.bind(this), false);
        //req.addEventListener("progress", updateProgress, false);
        //req.addEventListener("error", transferFailed, false);
        //req.addEventListener("abort", transferCanceled, false);
        if (callbackSingle) this._callbackSingle = callbackSingle;
        req.send(null);
        return this;
    },
    loadAll: function(options) {
        if (this._numtoLoad > 0) {
            if (options && options.callbackAll) this._callbackAll = options.callbackAll;
            for (var shader in this._shadersList) {
                if (this._shadersList.hasOwnProperty(shader)) {
                    this.load(this._shadersList[shader], shader, options && options.callbackSingle);
                }
            }
        }
        return this;
    },
    reloadAll: function(options) {
        this._shaderLoaded = {};
        this._loaded = false;
        this._numtoLoad = 0;
        for (var shader in this._shadersList) {
            if (this._shadersList.hasOwnProperty(shader)) {
                this._numtoLoad++;
            }
        }
        this.loadAll(options);
        return this;
    },
    reload: function(options) {
        this._shaderLoaded[options.shaderName] = undefined;
        this._loaded = false;
        this._numtoLoad = 1;
        this.load(this._shaders[options.shaderName], options && options.shaderName, options && options.callbackSingle);
        return this;
    },
    instrumentShaderlines: function(content, sourceID) {
        // TODO instrumentShaderlines
        // http://immersedcode.org/2012/1/12/random-notes-on-webgl/
        // one ID per "file"
        // Each file has its line number starting at 0
        //   handle include, the do that numbering also in preprocess...
        // Then on shader error using sourceID and line you can point the correct line...
        // has to attach that info to osg.shader object.
        /*
        var allLines = content.split('\n');
        var i = 0;
        for (var k = 0; k < allLines.length; k++) {
            if (!this._includeR.test(allLines[k])) {
                allLines[k] = "#line " + (i++) + " " + sourceID + '\n' + allLines[k] ;
            }
        }
        content = allLines.join('\n');
        */

        // seems just  prefixing first line seems ok to help renumbering error mesg
        return "\n#line " + 0 + " " + sourceID + '\n' + content;
    },
    getShaderTextPure: function(shaderName) {
        if (!(shaderName in this._shadersText)) {
            // directory include/prefix problems.
            for (var name in this._shadersText) {
                if (name.indexOf(shaderName) !== -1) {
                    preShader = this._shadersText[name];
                    break;
                }
            }
            if (!preShader) {
                console.error("shader file/text: " + shaderName + " not loaded");
                return '';
            }
        } else {
            preShader = this._shadersText[shaderName];
        }
        return preShader;
    },
    // recursively  handle #include external glsl
    // files (for now in the same folder.)
    preprocess: function(content, sourceID, includeList) {
        return content.replace(this._includeR, function(_, name) {
            // \#pragma include "name";
            // already included
            if (includeList.indexOf(name) !== -1) return;
            // avoid endless loop, not calling the impure
            var txt = this.getShaderTextPure(name);
            // make sure it's not included twice
            includeList.push(name);
            if (this._debugLines) {
                txt = this.instrumentShaderlines(txt, sourceID);
            }
            sourceID++;
            // to the infinite and beyond !
            txt = this.preprocess(txt, sourceID, includeList);
            return txt;
        }.bind(this));
    },
    // from a filename and define
    //  get a full expanded single shader source code
    //  resolving include dependencies
    //  adding defines
    //  adding line instrumenting.
    getShaderText: function(shaderName, defines) {
        // useful for
        var includeList = [];
        var preShader = this.getShaderTextPure(shaderName);
        includeList.push(shaderName);
        var sourceID = 0;
        if (this._debugLines) {
            preShader = this.instrumentShaderlines(preShader, sourceID);
            sourceID++;
        }
        var postShader = this.preprocess(preShader, sourceID, includeList);

        var prePrend = '';
        if (this._globalDefaultprecision) {
            if (!this._precisionR.test(postShader)) {
                // use the shaderhighprecision flag at shaderloader start
                //var highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
                //var highpSupported = highp.precision != 0;
                prePrend += this._globalDefaultprecision + "\n";
            }
        }
        if (!defines) defines = [];
        defines.push(this._globalDefaultDefines);

        prePrend += defines.join('\n') + "\n";
        postShader = prePrend + postShader;
        // TODO keep/cache processed shader text ?
        // same cache as getShaderObject
        return postShader;
    },
    // from a filename and define get a shaderobject (maybe cached.)
    getShaderObject: function(shaderName, defines, type) {
        // TODO handle define combination in compiled shader cache...
        //var inCache = either a key using hashobj with {shaderObj and define}
        // or a  full array search with name + all define Test.
        if (!(shaderName in this._shadersObject)) {
            if (!defines) defines = [];
            var defineInitCopy = defines.slice(0, defines.length);
            if (type == osg.Shader.VERTEX_SHADER) defines.splice(0, 0, "#define FRAGMENT_SHADER\n");
            else defines.splice(0, 0, "#define VERTEX_SHADER\n");
            var shaderObject = new osg.Shader(type, this.getShaderText(shaderName, defines));
            shaderObject.defines = defineInitCopy;
            this._shadersObject[shaderName] = shaderObject;
        }
        return this._shadersObject[shaderName];

    }
}, "osg", "ShaderLoader");