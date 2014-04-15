(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD.
        define([ 'Q', 'Hammer', 'Leap' ], factory);
    } else {
        // Browser globals
        root.OSG = factory( root.Q, root.Hammer, root.Leap );
    }
}(this, function ( Q, Hammer, Leap ) {

/**
 * almond 0.2.7 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../tools/build/almond", function(){});

define( 'osgNameSpace',[
], function ( ) {
    return {};
} );

define( 'osgUtil/osgPool',[], function () {

    /**
     * Authors:
     *  Tuan.kuranes <tuan.kuranes@gmail.com> Jerome Etienne <Jerome.etienne@gmail.com>
     */

    var osgPool = {};
    osgPool.memoryPools = {};

    /*
     *  TODO: Add stats & reports for developper per application  finer calibration (max, min, average)
     *  TODO: Debug Mode: check if not putting object twice, etc.
     *  USAGE: osg.memoryPools.stateGraph = new OsgObjectMemoryPool(osg.StateGraph).grow(50);
     */
    osgPool.OsgObjectMemoryPool = function ( ObjectClassName ) {
        return {
            _memPool: [],
            reset: function () {
                this._memPool = [];
                return this;
            },
            put: function ( obj ) {
                this._memPool.push( obj );
            },
            get: function () {
                if ( this._memPool.length > 0 ) return this._memPool.pop();
                this.grow();
                return this.get();
            },
            grow: function ( sizeAdd ) {
                if ( sizeAdd === undefined ) sizeAdd = ( this._memPool.length > 0 ) ? this._memPool.length * 2 : 20;
                var i = this._memPool.length;
                while ( i++ < sizeAdd ) this._memPool.push( new ObjectClassName() );
                return this;
            }
        };
    };

    /*
     *  TODO: the same for  TypedArrays.
     *  TODO: Add stats reports for developper per application  finer calibration (max, min, average)
     *  TODO: Debug Mode: check if not putting object twice, etc.
     *  USAGE: osg.memoryPools.arrayPool = new OsgArrayMemoryPool();
     *  mymatrix = osg.memoryPools.arrayPool.get(16);
     *  // do use matrix, etc..
     *  osg.memoryPools.arrayPool.put(mymatrix);
     */
    osgPool.OsgArrayMemoryPool = function () {
        return {
            _mempoolofPools: [],
            reset: function () {
                this._memPoolofPools = {};
                return this;
            },
            put: function ( obj ) {
                if ( !this._memPoolofPools[ obj.length ] )
                    this._memPoolofPools[ obj.length ] = [];
                this._memPoolofPools[ obj.length ].push( obj );
            },
            get: function ( arraySize ) {
                if ( !this._memPoolofPools[ arraySize ] )
                    this._memPoolofPools[ arraySize ] = [];
                else if ( this._memPoolofPools.length > 0 )
                    return this._memPool.pop();
                this.grow( arraySize );
                return this.get();
            },
            grow: function ( arraySize, sizeAdd ) {
                if ( sizeAdd === undefined ) sizeAdd = ( this._memPool.length > 0 ) ? this._memPool.length * 2 : 20;
                var i = this._memPool.length;
                while ( i++ < sizeAdd ) this._memPool.push( new Array( arraySize ) );
                return this;
            }
        };
    };

    return osgPool;
} );

define( 'osg/StateGraph',[
    'osgUtil/osgPool'
], function ( osgPool ) {

    var StateGraph = function () {
        this.depth = 0;
        this.children = {};
        this.children.keys = [];
        this.leafs = [];
        this.stateset = undefined;
        this.parent = undefined;
    };

    StateGraph.prototype = {
        clean: function () {
            this.leafs.splice( 0, this.leafs.length );
            this.stateset = undefined;
            this.parent = undefined;
            this.depth = 0;
            var key, keys = this.children.keys;
            for ( var i = 0, l = keys.length; i < l; i++ ) {
                key = keys[ i ];
                this.children[ key ].clean();
                osgPool.memoryPools.stateGraph.put( this.children[ key ] );
            }
            this.children = {};
            keys.splice( 0, keys.length );
            this.children.keys = keys;
        },
        getStateSet: function () {
            return this.stateset;
        },
        findOrInsert: function ( stateset ) {
            var sg;
            if ( !this.children[ stateset.id ] ) {

                //sg = new StateGraph();
                sg = osgPool.memoryPools.stateGraph.get();

                sg.parent = this;
                sg.depth = this.depth + 1;
                sg.stateset = stateset;
                this.children[ stateset.id ] = sg;
                this.children.keys.push( stateset.id );
            } else {
                sg = this.children[ stateset.id ];
            }
            return sg;
        },
        moveToRootStateGraph: function ( state, sgCurrent ) {
            // need to pop back all statesets and matrices.
            while ( sgCurrent ) {
                if ( sgCurrent.stateSet ) {
                    state.popStateSet();
                }
                sgCurrent = sgCurrent._parent;
            }
        },
        moveStateGraph: function ( state, sgCurrent, sgNew ) {
            var stack = [];
            var i, l;
            if ( sgNew === sgCurrent || sgNew === undefined ) {
                return;
            }

            if ( sgCurrent === undefined ) {
                // push stateset from sgNew to root, and apply
                // stateset from root to sgNew
                do {
                    if ( sgNew.stateset !== undefined ) {
                        stack.push( sgNew.stateset );
                    }
                    sgNew = sgNew.parent;
                } while ( sgNew );

                for ( i = stack.length - 1, l = 0; i >= l; --i ) {
                    state.pushStateSet( stack[ i ] );
                }
                return;
            } else if ( sgCurrent.parent === sgNew.parent ) {
                // first handle the typical case which is two state groups
                // are neighbours.

                // state has changed so need to pop old state.
                if ( sgCurrent.stateset !== undefined ) {
                    state.popStateSet();
                }
                // and push new state.
                if ( sgNew.stateset !== undefined ) {
                    state.pushStateSet( sgNew.stateset );
                }
                return;
            }

            // need to pop back up to the same depth as the new state group.
            while ( sgCurrent.depth > sgNew.depth ) {
                if ( sgCurrent.stateset !== undefined ) {
                    state.popStateSet();
                }
                sgCurrent = sgCurrent.parent;
            }

            // use return path to trace back steps to sgNew.
            stack = [];

            // need to pop back up to the same depth as the curr state group.
            while ( sgNew.depth > sgCurrent.depth ) {
                if ( sgNew.stateset !== undefined ) {
                    stack.push( sgNew.stateset );
                }
                sgNew = sgNew.parent;
            }

            // now pop back up both parent paths until they agree.

            // DRT - 10/22/02
            // should be this to conform with above case where two StateGraph
            // nodes have the same parent
            while ( sgCurrent !== sgNew ) {
                if ( sgCurrent.stateset !== undefined ) {
                    state.popStateSet();
                }
                sgCurrent = sgCurrent.parent;

                if ( sgNew.stateset !== undefined ) {
                    stack.push( sgNew.stateset );
                }
                sgNew = sgNew.parent;
            }

            for ( i = stack.length - 1, l = 0; i >= l; --i ) {
                state.pushStateSet( stack[ i ] );
            }
        }
    };

    return StateGraph;
} );

define( 'osg/Notify',[], function () {

    var Notify = {};

    Notify.DEBUG = 0;
    Notify.INFO = 1;
    Notify.NOTICE = 2;
    Notify.WARN = 3;
    Notify.ERROR = 4;

    Notify.console = window.console;

    // #FIXME getStackTrace was initially in webgl-utils (as a global function) but only used in this file
    /** Obtain a stacktrace from the current stack http://eriwen.com/javascript/js-stack-trace/
     */
    function getStackTrace( err ) {
		if (Notify.console && Notify.console.trace){
			Notify.console.trace();
			return '';
        }
        var callstack = [];
        try {
            if ( arguments.length === 1 ) {
                throw err;
            } else {
                throw new Error();
            }
        } catch ( error ) {
            if ( error.stack ) { //Firefox and Chrome
                callstack = ( error.stack + '\n' ).replace( /^\S[^\(]+?[\n$]/gm, '' ).
                replace( /^\s+(at eval )?at\s+/gm, '' ).
                replace( /^([^\(]+?)([\n$])/gm, '{anonymous}()@$1$2' ).
                replace( /^Object.<anonymous>\s*\(([^\)]+)\)/gm, '{anonymous}()@$1' ).split( '\n' );
                // Remove call to this function
                callstack.shift();

            }
        }
        // Remove empty entries
        for ( var i = 0; i < callstack.length; ++i ) {
            if ( callstack[ i ] === '' ) {
                callstack.splice( i, 1 );
                --i;
            }
        }

        return callstack;
    }

    Notify.setNotifyLevel = function ( level ) {

        var log = function ( str ) {
            if ( this.console !== undefined ) {
                this.console.log( str, getStackTrace() );
            }
        };

        var info = function ( str ) {
            if ( this.console !== undefined ) {
                this.console.info( str, getStackTrace() );
            }
        };

        var warn = function ( str ) {
            if ( this.console !== undefined ) {
                this.console.warn( str, getStackTrace() );
            }
        };

        var error = function ( str ) {
            if ( this.console !== undefined ) {
                this.console.error( str, getStackTrace() );
            }
        };

        var debug = function ( str ) {
            if ( this.console !== undefined ) {
                this.console.debug( str, getStackTrace() );
            }
        };

        var dummy = function () {};

        Notify.debug = dummy;
        Notify.info = dummy;
        Notify.log = Notify.notice = dummy;
        Notify.warn = dummy;
        Notify.error = dummy;

        if ( level <= Notify.DEBUG ) {
            Notify.debug = debug;
        }
        if ( level <= Notify.INFO ) {
            Notify.info = info;
        }
        if ( level <= Notify.NOTICE ) {
            Notify.log = Notify.notice = log;
        }
        if ( level <= Notify.WARN ) {
            Notify.warn = warn;
        }
        if ( level <= Notify.ERROR ) {
            Notify.error = error;
        }
    };

    Notify.setNotifyLevel( Notify.NOTICE );

    Notify.reportWebGLError = false;

    Notify.setConsole = function( replacement ) {
        Notify.console = replacement;
    };

    return Notify;
} );

define( 'osg/Utils',[
    'osgUtil/osgPool',
    'osg/StateGraph',
    'osg/Notify'
], function ( osgPool, StateGraph, Notify ) {

    // make the warning about StateGraph desappear
    Object.keys( StateGraph );

    var Utils = {};

    Utils.init = function () {
        var StateGraphClass = require( 'osg/StateGraph' );
        osgPool.memoryPools.stateGraph = new osgPool.OsgObjectMemoryPool( StateGraphClass ).grow( 50 );
    };

    var toString = Object.prototype.toString;
    Utils.isArray = function ( obj ) {
        return toString.call( obj ) === '[object Array]';
    };

    Utils.extend = function () {
        // Save a reference to some core methods
        var toString = Object.prototype.toString,
            hasOwnPropertyFunc = Object.prototype.hasOwnProperty;

        var isFunction = function ( obj ) {
            return toString.call( obj ) === '[object Function]';
        };
        var isArray = Utils.isArray;
        var isPlainObject = function ( obj ) {
            // Must be an Object.
            // Because of IE, we also have to check the presence of the constructor property.
            // Make sure that DOM nodes and window objects don't pass through, as well
            if ( !obj || toString.call( obj ) !== '[object Object]' || obj.nodeType || obj.setInterval ) {
                return false;
            }

            // Not own constructor property must be Object
            if ( obj.constructor && !hasOwnPropertyFunc.call( obj, 'constructor' ) && !hasOwnPropertyFunc.call( obj.constructor.prototype, 'isPrototypeOf' ) ) {
                return false;
            }

            // Own properties are enumerated firstly, so to speed up,
            // if last one is own, then all properties are own.

            var key;
            for ( key in obj ) {}

            return key === undefined || hasOwnPropertyFunc.call( obj, key );
        };

        // copy reference to target object
        var target = arguments[ 0 ] || {}, i = 1,
            length = arguments.length,
            deep = false,
            options, name, src, copy;

        // Handle a deep copy situation
        if ( typeof target === 'boolean' ) {
            deep = target;
            target = arguments[ 1 ] || {};
            // skip the boolean and the target
            i = 2;
        }

        // Handle case when target is a string or something (possible in deep copy)
        if ( typeof target !== 'object' && !isFunction( target ) ) {
            target = {};
        }

        // extend jQuery itself if only one argument is passed
        if ( length === i ) {
            target = this;
            --i;
        }

        for ( ; i < length; i++ ) {
            // Only deal with non-null/undefined values
            if ( ( options = arguments[ i ] ) !== null ) {
                // Extend the base object
                for ( name in options ) {
                    src = target[ name ];
                    copy = options[ name ];

                    // Prevent never-ending loop
                    if ( target === copy ) {
                        continue;
                    }

                    // Recurse if we're merging object literal values or arrays
                    if ( deep && copy && ( isPlainObject( copy ) || isArray( copy ) ) ) {
                        var clone = src && ( isPlainObject( src ) || isArray( src ) ) ? src : isArray( copy ) ? [] : {};

                        // Never move original objects, clone them
                        target[ name ] = Utils.extend( deep, clone, copy );

                        // Don't bring in undefined values
                    } else if ( copy !== undefined ) {
                        target[ name ] = copy;
                    }
                }
            }
        }

        // Return the modified object
        return target;
    };

    Utils.objectInehrit = Utils.objectInherit = function ( base /*, extras*/ ) {
        function F() {}
        F.prototype = base;
        var obj = new F();

        // let augment object with multiple arguement
        for ( var i = 1; i < arguments.length; i++ ) {
            Utils.objectMix( obj, arguments[ i ], false );
        }
        return obj;
    };
    Utils.objectMix = function ( obj, properties, test ) {
        for ( var key in properties ) {
            if ( !( test && obj[ key ] ) ) {
                obj[ key ] = properties[ key ];
            }
        }
        return obj;
    };

    Utils.objectType = {};
    Utils.objectType.type = 0;
    Utils.objectType.generate = function ( arg ) {
        var t = Utils.objectType.type;
        Utils.objectType[ t ] = arg;
        Utils.objectType[ arg ] = t;
        Utils.objectType.type += 1;
        return t;
    };

    Utils.objectLibraryClass = function ( object, libName, className ) {
        object.className = function () {
            return className;
        };
        object.libraryName = function () {
            return libName;
        };
        var libraryClassName = libName + '::' + className;
        object.libraryClassName = function () {
            return libraryClassName;
        };

        return object;
    };
    Utils.setTypeID = function ( classObject ) {
        var className = classObject.prototype.className();
        var typeID = Utils.objectType.generate( className );
        classObject.typeID = classObject.prototype.typeID = typeID;
    };

    Utils.Float32Array = typeof Float32Array !== 'undefined' ? Float32Array : null;
    Utils.Int32Array = typeof Int32Array !== 'undefined' ? Int32Array : null;
    Utils.Uint16Array = typeof Uint16Array !== 'undefined' ? Uint16Array : null;
    Utils.Uint32Array = typeof Uint32Array !== 'undefined' ? Uint32Array : null;

    Utils.performance = {};
    Utils.performance.now = ( function () {
        // if no window.performance
        if ( window.performance === undefined ) {
            return function () {
                return Date.now();
            };
        }

        var fn = window.performance.now || window.performance.mozNow || window.performance.msNow || window.performance.oNow || window.performance.webkitNow ||
                function () {
                    return Date.now();
            };
        return function () {
            return fn.apply( window.performance, arguments );
        };
    } )();

    Utils.timeStamp = function () {

        var fn = Notify.console.timeStamp || Notify.console.markTimeline || function () {};
        return fn.apply( Notify.console, arguments );

    };

    var times = {};

    Utils.time = function () {

        var fn = Notify.console.time || function ( name ) {
            times[ name ] = Utils.performance.now();
        };
        return fn.apply( Notify.console, arguments );

    };

    Utils.timeEnd = function () {

        var fn = Notify.console.timeEnd || function ( name ) {

            if ( times[ name ] === undefined )
                return;

            var now = Utils.performance.now();
            var duration = now - times[ name ];

            Notify.debug( name + ': ' + duration + 'ms');
            times[ name ] = undefined;

        };
        return fn.apply( Notify.console, arguments );

    };

    Utils.profile = ( function () {

        var fn = Notify.console.profile || function () {};
        return function () {
            return fn.apply( Notify.console, arguments );
        };

    } )();

    Utils.profileEnd = ( function () {

        var fn = Notify.console.profileEnd || function () {};
        return function () {
            return fn.apply( Notify.console, arguments );
        };

    } )();

    return Utils;
} );

define( 'osg/Object',[
    'osg/Utils'
], function ( MACROUTILS ) {

        /**
     *  Object class
     *  @class Object
     */
    var Object = function () {
        this._name = undefined;
        this._userdata = undefined;
        this._instanceID = Object.getInstanceID();
    };

    /** @lends Object.prototype */
    Object.prototype = MACROUTILS.objectLibraryClass( {
            getInstanceID: function () {
                return this._instanceID;
            },
            setName: function ( name ) {
                this._name = name;
            },
            getName: function () {
                return this._name;
            },
            setUserData: function ( data ) {
                this._userdata = data;
            },
            getUserData: function () {
                return this._userdata;
            }
        },
        'osg', 'Object' );


    // get an instanceID for each object
    ( function () {
        var instanceID = 0;
        Object.getInstanceID = function () {
            instanceID += 1;
            return instanceID;
        };
    } )();

    return Object;
} );

define( 'osg/StateAttribute',[
    'osg/Utils',
    'osg/Object'
], function ( MACROUTILS, Object ) {

    /**
     * StateAttribute base class
     * @class StateAttribute
     */
    var StateAttribute = function () {
        Object.call( this );
        this._dirty = true;
    };

    /** @lends StateAttribute.prototype */
    StateAttribute.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInherit( Object.prototype, {
        isDirty: function () {
            return this._dirty;
        },
        dirty: function () {
            this._dirty = true;
        },
        setDirty: function ( dirty ) {
            this._dirty = dirty;
        }
    } ), 'osg', 'StateAttribute' );

    StateAttribute.OFF = 0;
    StateAttribute.ON = 1;
    StateAttribute.OVERRIDE = 2;
    StateAttribute.PROTECTED = 4;
    StateAttribute.INHERIT = 8;

    return StateAttribute;
} );

define( 'osg/Vec4',[], function () {

    /** @class Vec4 Operations */
    var Vec4 = {
        init: function ( a ) {
            a[ 0 ] = 0.0;
            a[ 1 ] = 0.0;
            a[ 2 ] = 0.0;
            a[ 3 ] = 0.0;
            return a;
        },

        dot: function ( a, b ) {
            return a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ] + a[ 3 ] * b[ 3 ];
        },

        copy: function ( a, r ) {
            r[ 0 ] = a[ 0 ];
            r[ 1 ] = a[ 1 ];
            r[ 2 ] = a[ 2 ];
            r[ 3 ] = a[ 3 ];
            return r;
        },

        sub: function ( a, b, r ) {
            r[ 0 ] = a[ 0 ] - b[ 0 ];
            r[ 1 ] = a[ 1 ] - b[ 1 ];
            r[ 2 ] = a[ 2 ] - b[ 2 ];
            r[ 3 ] = a[ 3 ] - b[ 3 ];
            return r;
        },

        mult: function ( a, b, r ) {
            r[ 0 ] = a[ 0 ] * b;
            r[ 1 ] = a[ 1 ] * b;
            r[ 2 ] = a[ 2 ] * b;
            r[ 3 ] = a[ 3 ] * b;
            return r;
        },

        add: function ( a, b, r ) {
            r[ 0 ] = a[ 0 ] + b[ 0 ];
            r[ 1 ] = a[ 1 ] + b[ 1 ];
            r[ 2 ] = a[ 2 ] + b[ 2 ];
            r[ 3 ] = a[ 3 ] + b[ 3 ];
            return r;
        },

        neg: function ( a, r ) {
            r[ 0 ] = -a[ 0 ];
            r[ 1 ] = -a[ 1 ];
            r[ 2 ] = -a[ 2 ];
            r[ 3 ] = -a[ 3 ];
            return r;
        },

        lerp: function ( t, a, b, r ) {
            var tmp = 1.0 - t;
            r[ 0 ] = a[ 0 ] * tmp + t * b[ 0 ];
            r[ 1 ] = a[ 1 ] * tmp + t * b[ 1 ];
            r[ 2 ] = a[ 2 ] * tmp + t * b[ 2 ];
            r[ 3 ] = a[ 3 ] * tmp + t * b[ 3 ];
            return r;
        }
    };

    return Vec4;
} );

define( 'osg/BlendColor',[
    'osg/Utils',
    'osg/StateAttribute',
    'osg/Vec4'
], function ( MACROUTILS, StateAttribute, Vec4 ) {

    /**
     *  Manage BlendColor attribute
     *  @class BlendColor
     */
    var BlendColor = function ( color ) {
        StateAttribute.call( this );
        this._constantColor = new Array( 4 );
        this._constantColor[ 0 ] = this._constantColor[ 1 ] = this._constantColor[ 2 ] = this._constantColor[ 3 ] = 1.0;
        if ( color !== undefined ) {
            this.setConstantColor( color );
        }
    };

    /** @lends BlendColor.prototype */
    BlendColor.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( StateAttribute.prototype, {
        attributeType: 'BlendColor',
        cloneType: function () {
            return new BlendColor();
        },
        getType: function () {
            return this.attributeType;
        },
        getTypeMember: function () {
            return this.attributeType;
        },
        setConstantColor: function ( color ) {
            Vec4.copy( color, this._constantColor );
        },
        getConstantColor: function () {
            return this._constantColor;
        },
        apply: function ( state ) {
            var gl = state.getGraphicContext();
            gl.blendColor( this._constantColor[ 0 ],
                this._constantColor[ 1 ],
                this._constantColor[ 2 ],
                this._constantColor[ 3 ] );
            this._dirty = false;
        }
    } ), 'osg', 'BlendColor' );

    return BlendColor;
} );

define( 'osg/BlendFunc',[
    'osg/Utils',
    'osg/StateAttribute'
], function ( MACROUTILS, StateAttribute ) {

    /**
     *  Manage Blending mode
     *  @class BlendFunc
     */
    var BlendFunc = function ( sourceRGB, destinationRGB, sourceAlpha, destinationAlpha ) {
        StateAttribute.call( this );
        this._sourceFactor = BlendFunc.ONE;
        this._destinationFactor = BlendFunc.ZERO;
        this._sourceFactorAlpha = this._sourceFactor;
        this._destinationFactorAlpha = this._destinationFactor;
        this._separate = false;
        if ( sourceRGB !== undefined ) {
            this.setSource( sourceRGB );
        }
        if ( destinationRGB !== undefined ) {
            this.setDestination( destinationRGB );
        }

        if ( sourceAlpha !== undefined ) {
            this.setSourceAlpha( sourceAlpha );
        }
        if ( destinationAlpha !== undefined ) {
            this.setDestinationAlpha( destinationAlpha );
        }
    };

    BlendFunc.ZERO = 0;
    BlendFunc.ONE = 1;
    BlendFunc.SRC_COLOR = 0x0300;
    BlendFunc.ONE_MINUS_SRC_COLOR = 0x0301;
    BlendFunc.SRC_ALPHA = 0x0302;
    BlendFunc.ONE_MINUS_SRC_ALPHA = 0x0303;
    BlendFunc.DST_ALPHA = 0x0304;
    BlendFunc.ONE_MINUS_DST_ALPHA = 0x0305;
    BlendFunc.DST_COLOR = 0x0306;
    BlendFunc.ONE_MINUS_DST_COLOR = 0x0307;
    BlendFunc.SRC_ALPHA_SATURATE = 0x0308;

    /* Separate Blend Functions */
    BlendFunc.BLEND_DST_RGB = 0x80C8;
    BlendFunc.BLEND_SRC_RGB = 0x80C9;
    BlendFunc.BLEND_DST_ALPHA = 0x80CA;
    BlendFunc.BLEND_SRC_ALPHA = 0x80CB;
    BlendFunc.CONSTANT_COLOR = 0x8001;
    BlendFunc.ONE_MINUS_CONSTANT_COLOR = 0x8002;
    BlendFunc.CONSTANT_ALPHA = 0x8003;
    BlendFunc.ONE_MINUS_CONSTANT_ALPHA = 0x8004;
    BlendFunc.BLEND_COLOR = 0x8005;


    /** @lends BlendFunc.prototype */
    BlendFunc.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( StateAttribute.prototype, {
        /**
    StateAttribute type of BlendFunc
    @type String
     */
        attributeType: 'BlendFunc',
        /**
        Create an instance of this StateAttribute
        */
        cloneType: function () /**BlendFunc*/ {
            return new BlendFunc();
        },
        /**
        @type String
        */
        getType: function () {
            return this.attributeType;
        },
        /**
        @type String
        */
        getTypeMember: function () {
            return this.attributeType;
        },
        setSource: function ( f ) {
            this.setSourceRGB( f );
            this.setSourceAlpha( f );
        },
        setDestination: function ( f ) {
            this.setDestinationRGB( f );
            this.setDestinationAlpha( f );
        },
        checkSeparate: function () {
            return ( this._sourceFactor !== this._sourceFactorAlpha ||
                this._destinationFactor !== this._destinationFactorAlpha );
        },
        setSourceRGB: function ( f ) {
            if ( typeof f === 'string' ) {
                this._sourceFactor = BlendFunc[ f ];
            } else {
                this._sourceFactor = f;
            }
            this._separate = this.checkSeparate();
        },
        setSourceAlpha: function ( f ) {
            if ( typeof f === 'string' ) {
                this._sourceFactorAlpha = BlendFunc[ f ];
            } else {
                this._sourceFactorAlpha = f;
            }
            this._separate = this.checkSeparate();
        },
        setDestinationRGB: function ( f ) {
            if ( typeof f === 'string' ) {
                this._destinationFactor = BlendFunc[ f ];
            } else {
                this._destinationFactor = f;
            }
            this._separate = this.checkSeparate();
        },
        setDestinationAlpha: function ( f ) {
            if ( typeof f === 'string' ) {
                this._destinationFactorAlpha = BlendFunc[ f ];
            } else {
                this._destinationFactorAlpha = f;
            }
            this._separate = this.checkSeparate();
        },

        /**
        Apply the mode, must be called in the draw traversal
        @param state
    */
        apply: function ( state ) {
            var gl = state.getGraphicContext();
            gl.enable( gl.BLEND );
            if ( this._separate ) {
                gl.blendFuncSeparate( this._sourceFactor, this._destinationFactor,
                    this._sourceFactorAlpha, this._destinationFactorAlpha );
            } else {
                gl.blendFunc( this._sourceFactor, this._destinationFactor );
            }
        }
    } ), 'osg', 'BlendFunc' );

    return BlendFunc;
} );

define( 'osg/BoundingBox',[
    'osg/Utils'
], function ( MACROUTILS ) {

    var BoundingBox = function () {
        this.init();
    };
    BoundingBox.prototype = MACROUTILS.objectLibraryClass( {
        _cacheRadius2: [ 0.0, 0.0, 0.0 ],

        init: function () {
            this._min = [ Infinity, Infinity, Infinity ];
            this._max = [ -Infinity, -Infinity, -Infinity ];
        },

        copy: function ( bbox ) {
            var min = this._min;
            var bmin = bbox._min;
            min[ 0 ] = bmin[ 0 ];
            min[ 1 ] = bmin[ 1 ];
            min[ 2 ] = bmin[ 2 ];

            var max = this._max;
            var bmax = bbox._max;
            max[ 0 ] = bmax[ 0 ];
            max[ 1 ] = bmax[ 1 ];
            max[ 2 ] = bmax[ 2 ];
        },

        valid: function () {
            return ( this._max[ 0 ] >= this._min[ 0 ] && this._max[ 1 ] >= this._min[ 1 ] && this._max[ 2 ] >= this._min[ 2 ] );
        },

        expandBySphere: function ( sh ) {
            if ( !sh.valid() ) {
                return;
            }
            var max = this._max;
            var min = this._min;
            min[ 0 ] = Math.min( min[ 0 ], sh._center[ 0 ] - sh._radius );
            min[ 1 ] = Math.min( min[ 1 ], sh._center[ 1 ] - sh._radius );
            min[ 2 ] = Math.min( min[ 2 ], sh._center[ 2 ] - sh._radius );

            max[ 0 ] = Math.max( max[ 0 ], sh._center[ 0 ] + sh._radius );
            max[ 1 ] = Math.max( max[ 1 ], sh._center[ 1 ] + sh._radius );
            max[ 2 ] = Math.max( max[ 2 ], sh._center[ 2 ] + sh._radius );
        },

        expandByVec3: function ( v ) {
            var min = this._min;
            var max = this._max;
            min[ 0 ] = Math.min( min[ 0 ], v[ 0 ] );
            min[ 1 ] = Math.min( min[ 1 ], v[ 1 ] );
            min[ 2 ] = Math.min( min[ 2 ], v[ 2 ] );

            max[ 0 ] = Math.max( max[ 0 ], v[ 0 ] );
            max[ 1 ] = Math.max( max[ 1 ], v[ 1 ] );
            max[ 2 ] = Math.max( max[ 2 ], v[ 2 ] );
        },

        expandByBoundingBox: function ( bb ) {
            if ( !bb.valid() )
                return;

            var min = this._min;
            var max = this._max;
            var bbmin = bb._min;
            var bbmax = bb._max;

            if ( bbmin[ 0 ] < min[ 0 ] ) min[ 0 ] = bbmin[ 0 ];
            if ( bbmax[ 0 ] > max[ 0 ] ) max[ 0 ] = bbmax[ 0 ];

            if ( bbmin[ 1 ] < min[ 1 ] ) min[ 1 ] = bbmin[ 1 ];
            if ( bbmax[ 1 ] > max[ 1 ] ) max[ 1 ] = bbmax[ 1 ];

            if ( bbmin[ 2 ] < min[ 2 ] ) min[ 2 ] = bbmin[ 2 ];
            if ( bbmax[ 2 ] > max[ 2 ] ) max[ 2 ] = bbmax[ 2 ];
        },

        center: function () {
            var min = this._min;
            var max = this._max;
            return [ ( min[ 0 ] + max[ 0 ] ) * 0.5, ( min[ 1 ] + max[ 1 ] ) * 0.5, ( min[ 2 ] + max[ 2 ] ) * 0.5 ];
        },

        radius: function () {
            return Math.sqrt( this.radius2() );
        },

        radius2: function () {
            var min = this._min;
            var max = this._max;
            var cache = this._cacheRadius2;
            cache[ 0 ] = max[ 0 ] - min[ 0 ];
            cache[ 1 ] = max[ 1 ] - min[ 1 ];
            cache[ 2 ] = max[ 2 ] - min[ 2 ];
            return 0.25 * ( cache[ 0 ] * cache[ 0 ] + cache[ 1 ] * cache[ 1 ] + cache[ 2 ] * cache[ 2 ] );
        },
        corner: function ( pos ) {
            /*jshint bitwise: false */
            var ret = [ 0.0, 0.0, 0.0 ];
            if ( pos & 1 ) {
                ret[ 0 ] = this._max[ 0 ];
            } else {
                ret[ 0 ] = this._min[ 0 ];
            }
            if ( pos & 2 ) {
                ret[ 1 ] = this._max[ 1 ];
            } else {
                ret[ 1 ] = this._min[ 1 ];
            }
            if ( pos & 4 ) {
                ret[ 2 ] = this._max[ 2 ];
            } else {
                ret[ 2 ] = this._min[ 2 ];
            }
            return ret;
            /*jshint bitwise: true */
        }
    }, 'osg', 'BoundingBox' );

    return BoundingBox;
} );

define( 'osg/Vec3',[], function () {

    /** @class Vec3 Operations */
    var Vec3 = {
        init: function ( a ) {
            a[ 0 ] = 0.0;
            a[ 1 ] = 0.0;
            a[ 2 ] = 0.0;
            return a;
        },

        copy: function ( a, r ) {
            r[ 0 ] = a[ 0 ];
            r[ 1 ] = a[ 1 ];
            r[ 2 ] = a[ 2 ];
            return r;
        },

        cross: function ( a, b, r ) {
            var x = a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ];
            var y = a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ];
            var z = a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ];
            r[ 0 ] = x;
            r[ 1 ] = y;
            r[ 2 ] = z;
            return r;
        },

        valid: function ( a ) {
            if ( isNaN( a[ 0 ] ) ) {
                return false;
            }
            if ( isNaN( a[ 1 ] ) ) {
                return false;
            }
            if ( isNaN( a[ 2 ] ) ) {
                return false;
            }
            return true;
        },

        mult: function ( a, b, r ) {
            r[ 0 ] = a[ 0 ] * b;
            r[ 1 ] = a[ 1 ] * b;
            r[ 2 ] = a[ 2 ] * b;
            return r;
        },

        length2: function ( a ) {
            return a[ 0 ] * a[ 0 ] + a[ 1 ] * a[ 1 ] + a[ 2 ] * a[ 2 ];
        },

        length: function ( a ) {
            return Math.sqrt( a[ 0 ] * a[ 0 ] + a[ 1 ] * a[ 1 ] + a[ 2 ] * a[ 2 ] );
        },

        distance2: function ( a, b ) {
            var x = a[ 0 ] - b[ 0 ];
            var y = a[ 1 ] - b[ 1 ];
            var z = a[ 2 ] - b[ 2 ];
            return x * x + y * y + z * z;
        },

        distance: function ( a, b ) {
            var x = a[ 0 ] - b[ 0 ];
            var y = a[ 1 ] - b[ 1 ];
            var z = a[ 2 ] - b[ 2 ];
            return Math.sqrt( x * x + y * y + z * z );
        },

        normalize: function ( a, r ) {
            var norm = this.length2( a );
            if ( norm > 0.0 ) {
                var inv = 1.0 / Math.sqrt( norm );
                r[ 0 ] = a[ 0 ] * inv;
                r[ 1 ] = a[ 1 ] * inv;
                r[ 2 ] = a[ 2 ] * inv;
            } else {
                r[ 0 ] = a[ 0 ];
                r[ 1 ] = a[ 1 ];
                r[ 2 ] = a[ 2 ];
            }
            return r;
        },

        dot: function ( a, b ) {
            return a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];
        },

        sub: function ( a, b, r ) {
            r[ 0 ] = a[ 0 ] - b[ 0 ];
            r[ 1 ] = a[ 1 ] - b[ 1 ];
            r[ 2 ] = a[ 2 ] - b[ 2 ];
            return r;
        },

        add: function ( a, b, r ) {
            r[ 0 ] = a[ 0 ] + b[ 0 ];
            r[ 1 ] = a[ 1 ] + b[ 1 ];
            r[ 2 ] = a[ 2 ] + b[ 2 ];
            return r;
        },

        neg: function ( a, r ) {
            r[ 0 ] = -a[ 0 ];
            r[ 1 ] = -a[ 1 ];
            r[ 2 ] = -a[ 2 ];
            return r;
        },

        lerp: function ( t, a, b, r ) {
            r[ 0 ] = a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t;
            r[ 1 ] = a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t;
            r[ 2 ] = a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * t;
            return r;
        }

    };

    return Vec3;
} );

define( 'osg/BoundingSphere',[
    'osg/Vec3',
    'osg/BoundingBox'
], function ( Vec3, BoundingBox ) {

    var BoundingSphere = function () {
        this._center = [ 0.0, 0.0, 0.0 ];
        this._radius = -1;
    };

    BoundingSphere.prototype = {
        init: function () {
            Vec3.init( this._center );
            this._radius = -1;
        },
        valid: function () {
            return this._radius >= 0.0;
        },
        set: function ( center, radius ) {
            this._center = center;
            this._radius = radius;
        },
        center: function () {
            return this._center;
        },
        radius: function () {
            return this._radius;
        },
        radius2: function () {
            return this._radius * this._radius;
        },

        expandByBox: ( function () {
            var v = [ 0.0, 0.0, 0.0 ];
            var newbb = new BoundingBox();
            return function ( bb ) {
                if ( !bb.valid() )
                    return;

                var c;
                if ( this.valid() ) {
                    newbb._min[ 0 ] = bb._min[ 0 ];
                    newbb._min[ 1 ] = bb._min[ 1 ];
                    newbb._min[ 2 ] = bb._min[ 2 ];
                    newbb._max[ 0 ] = bb._max[ 0 ];
                    newbb._max[ 1 ] = bb._max[ 1 ];
                    newbb._max[ 2 ] = bb._max[ 2 ];

                    for ( var i = 0; i < 8; i++ ) {
                        Vec3.sub( bb.corner( c ), this._center, v ); // get the direction vector from corner
                        Vec3.normalize( v, v ); // normalise it.
                        v[ 0 ] *= -this._radius; // move the vector in the opposite direction distance radius.
                        v[ 1 ] *= -this._radius; // move the vector in the opposite direction distance radius.
                        v[ 2 ] *= -this._radius; // move the vector in the opposite direction distance radius.
                        v[ 0 ] += this._center[ 0 ]; // move to absolute position.
                        v[ 1 ] += this._center[ 1 ]; // move to absolute position.
                        v[ 2 ] += this._center[ 2 ]; // move to absolute position.
                        newbb.expandBy( v ); // add it into the new bounding box.
                    }

                    c = newbb.center();
                    this._center[ 0 ] = c[ 0 ];
                    this._center[ 1 ] = c[ 1 ];
                    this._center[ 2 ] = c[ 2 ];
                    this._radius = newbb.radius();
                } else {
                    c = bb.center();
                    this._center[ 0 ] = c[ 0 ];
                    this._center[ 1 ] = c[ 1 ];
                    this._center[ 2 ] = c[ 2 ];
                    this._radius = bb.radius();
                }
            };
        } )(),

        expandByVec3: ( function () {
            var dv = [ 0.0, 0.0, 0.0 ];
            return function ( v ) {
                if ( this.valid() ) {
                    Vec3.sub( v, this.center(), dv );
                    var r = Vec3.length( dv );
                    if ( r > this.radius() ) {
                        var dr = ( r - this.radius() ) * 0.5;
                        this._center[ 0 ] += dv[ 0 ] * ( dr / r );
                        this._center[ 1 ] += dv[ 1 ] * ( dr / r );
                        this._center[ 2 ] += dv[ 2 ] * ( dr / r );
                        this._radius += dr;
                    }
                } else {
                    this._center[ 0 ] = v[ 0 ];
                    this._center[ 1 ] = v[ 1 ];
                    this._center[ 2 ] = v[ 2 ];
                    this._radius = 0.0;
                }
            };
        } )(),

        expandRadiusBySphere: function ( sh ) {
            if ( sh.valid() ) {
                if ( this.valid() ) {
                    var r = Vec3.distance( sh._center, this._center ) + sh._radius;
                    if ( r > this._radius ) {
                        this._radius = r;
                    }
                    // else do nothing as vertex is within sphere.
                } else {
                    Vec3.copy( sh._center, this._center );
                    this._radius = sh._radius;
                }
            }
        },
        expandBy: function ( sh ) {
            // ignore operation if incomming BoundingSphere is invalid.
            if ( !sh.valid() ) {
                return;
            }

            // This sphere is not set so use the inbound sphere
            if ( !this.valid() ) {
                this._center[ 0 ] = sh._center[ 0 ];
                this._center[ 1 ] = sh._center[ 1 ];
                this._center[ 2 ] = sh._center[ 2 ];
                this._radius = sh.radius();

                return;
            }

            // Calculate d == The distance between the sphere centers
            var d = Vec3.distance( this.center(), sh.center() );

            // New sphere is already inside this one
            if ( d + sh.radius() <= this.radius() ) {
                return;
            }

            //  New sphere completely contains this one
            if ( d + this.radius() <= sh.radius() ) {
                this._center[ 0 ] = sh._center[ 0 ];
                this._center[ 1 ] = sh._center[ 1 ];
                this._center[ 2 ] = sh._center[ 2 ];
                this._radius = sh._radius;
                return;
            }


            // Build a new sphere that completely contains the other two:
            //
            // The center point lies halfway along the line between the furthest
            // points on the edges of the two spheres.
            //
            // Computing those two points is ugly - so we'll use similar triangles
            var newRadius = ( this.radius() + d + sh.radius() ) * 0.5;
            var ratio = ( newRadius - this.radius() ) / d;

            this._center[ 0 ] += ( sh._center[ 0 ] - this._center[ 0 ] ) * ratio;
            this._center[ 1 ] += ( sh._center[ 1 ] - this._center[ 1 ] ) * ratio;
            this._center[ 2 ] += ( sh._center[ 2 ] - this._center[ 2 ] ) * ratio;

            this._radius = newRadius;
        },
        contains: function ( v ) {
            if ( !this.valid() )
                return false;
            return Vec3.distance2( v, this.center() ) <= this.radius2();
        },
        intersects: function ( bs ) {
            if ( !this.valid() )
                return false;
            if ( !bs.valid() )
                return false;
            var lc = Vec3.distance2( this.center(), bs.center() );
            var r = this.radius() + bs.radius();
            return lc <= r;
        }
    };

    return BoundingSphere;
} );

define( 'osg/BufferArray',[
    'osg/Utils',
    'osg/Notify',
    'osg/Object'

], function ( MACROUTILS, Notify, Object ) {

    /**
     * BufferArray manage vertex / normal / ... array used by webgl.
     * @class BufferArray
     */
    var BufferArray = function ( type, elements, itemSize ) {

        // maybe could inherit from Object
        this._instanceID = Object.getInstanceID();

        this.dirty();

        this._itemSize = itemSize;
        if ( typeof ( type ) === 'string' ) {
            type = BufferArray[ type ];
        }
        this._type = type;

        if ( elements !== undefined ) {
            if ( this._type === BufferArray.ELEMENT_ARRAY_BUFFER ) {
                this._elements = new MACROUTILS.Uint16Array( elements );
            } else {
                this._elements = new MACROUTILS.Float32Array( elements );
            }
        }
    };

    BufferArray.ELEMENT_ARRAY_BUFFER = 0x8893;
    BufferArray.ARRAY_BUFFER = 0x8892;


    /** @lends BufferArray.prototype */
    BufferArray.prototype = {
        setItemSize: function ( size ) {
            this._itemSize = size;
        },
        isValid: function () {
            if ( this._buffer !== undefined ||
                this._elements !== undefined ) {
                return true;
            }
            return false;
        },

        releaseGLObjects: function ( gl ) {
            if ( this._buffer !== undefined && this._buffer !== null ) {
                gl.deleteBuffer( this._buffer );
            }
            this._buffer = undefined;
        },

        bind: function ( gl ) {

            var type = this._type;
            var buffer = this._buffer;

            if ( buffer ) {
                gl.bindBuffer( type, buffer );
                return;
            }

            if ( !buffer && this._elements.length > 0 ) {
                this._buffer = gl.createBuffer();
                this._numItems = this._elements.length / this._itemSize;
                gl.bindBuffer( type, this._buffer );
            }
        },
        getItemSize: function () {
            return this._itemSize;
        },
        dirty: function () {
            this._dirty = true;
        },
        isDirty: function () {
            return this._dirty;
        },
        compile: function ( gl ) {
            if ( this._dirty ) {
                MACROUTILS.timeStamp( 'osgjs.metrics:bufferData' );
                gl.bufferData( this._type, this._elements, gl.STATIC_DRAW );
                this._dirty = false;
            }
        },
        getElements: function () {
            return this._elements;
        },
        setElements: function ( elements ) {
            this._elements = elements;
            this._dirty = true;
        }
    };

    BufferArray.create = function ( type, elements, itemSize ) {
        Notify.log( 'BufferArray.create is deprecated, use new BufferArray with same arguments instead' );
        return new BufferArray( type, elements, itemSize );
    };

    return BufferArray;
} );

define( 'osg/Map',[

], function () {

    var Map = function() {
        this._dirty = true;
        this._map = {};
        this._keys = undefined;
    };

    Map.prototype = {
        dirty: function() { this._dirty = true; },
        setMapContent: function( map ) { this._map = map; this._dirty = true; },
        getMapContent: function() { return this._map; },
        getKeys: function() {
            if ( this._dirty ) {
                this._keys = Object.keys( this._map );
                this._dirty = false;
            }
            return this._keys;
        }
    };

    return Map;

});

define( 'osg/StateSet',[
    'osg/Utils',
    'osg/StateAttribute',
    'osg/Object',
    'osg/Map'
], function ( MACROUTILS, StateAttribute, Object, Map ) {

    /**
     * StateSet encapsulate StateAttribute
     * @class StateSet
     */
    var StateSet = function () {
        Object.call( this );
        this.id = StateSet.instance++;

        this.attributeMap = new Map();

        this.textureAttributeMapList = [];

        this._binName = undefined;
        this._binNumber = 0;

        this._shaderGenerator = undefined;

        this.uniforms = new Map();

    };
    StateSet.instance = 0;

    StateSet.AttributePair = function ( attr, value ) {
        this._object = attr;
        this._value = value;
    };
    StateSet.AttributePair.prototype = {
        getAttribute: function () {
            return this._object;
        },
        getUniform: function () {
            return this._object;
        },
        getValue: function () {
            return this._value;
        }
    };

    /** @lends StateSet.prototype */
    StateSet.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( Object.prototype, {
        getAttributePair: function ( attribute, value ) {
            return new StateSet.AttributePair( attribute, value );
        },
        addUniform: function ( uniform, mode ) {
            if ( mode === undefined ) {
                mode = StateAttribute.ON;
            }

            var name = uniform.name;
            this.uniforms.getMapContent()[ name ] = this.getAttributePair( uniform, mode );
            this.uniforms.dirty();
        },
        getUniform: function ( uniform ) {
            var map = this.uniforms.getMapContent();
            if ( map[ uniform ] ) return map[ uniform ].getAttribute();

            return undefined;
        },
        getUniformList: function () {
            return this.uniforms.getMapContent();
        },

        setTextureAttributeAndMode: function ( unit, attribute, mode ) {
            if ( mode === undefined ) {
                mode = StateAttribute.ON;
            }
            this._setTextureAttribute( unit, this.getAttributePair( attribute, mode ) );
        },
        getNumTextureAttributeLists: function () {
            return this.textureAttributeMapList.length;
        },
        getTextureAttribute: function ( unit, attribute ) {
            if ( this.textureAttributeMapList[ unit ] === undefined ) return undefined;

            var textureMapContent = this.textureAttributeMapList[ unit ].getMapContent();
            if ( textureMapContent[ attribute ] === undefined ) return undefined;

            return textureMapContent[ attribute ].getAttribute();
        },

        removeTextureAttribute: function ( unit, attributeName ) {
            if ( this.textureAttributeMapList[ unit ] === undefined ) return;

            var textureAttributeMapContent = this.textureAttributeMapList[ unit ].getMapContent();
            if ( textureAttributeMapContent[ attributeName ] === undefined ) return;


            delete textureAttributeMapContent[ attributeName ];
            this.textureAttributeMapList[ unit ].dirty();
        },

        getAttribute: function ( attributeType ) {
            if ( this.attributeMap.getMapContent()[ attributeType ] === undefined ) {
                return undefined;
            }
            return this.attributeMap.getMapContent()[ attributeType ].getAttribute();
        },
        setAttributeAndMode: function ( attribute, mode ) {
            if ( mode === undefined ) {
                mode = StateAttribute.ON;
            }
            this._setAttribute( this.getAttributePair( attribute, mode ) );
        },
        setAttribute: function ( attribute, mode ) {
            if ( mode === undefined ) {
                mode = StateAttribute.ON;
            }
            this._setAttribute( this.getAttributePair( attribute, mode ) );
        },

        // TODO: check if it's an attribute type or a attribute to remove it
        removeAttribute: function ( attributeName ) {

            if ( this.attributeMap.getMapContent()[ attributeName ] !== undefined ) {
                delete this.attributeMap.getMapContent()[ attributeName ];
                this.attributeMap.dirty();
            }
        },

        setRenderingHint: function ( hint ) {
            if ( hint === 'OPAQUE_BIN' ) {
                this.setRenderBinDetails( 0, 'RenderBin' );
            } else if ( hint === 'TRANSPARENT_BIN' ) {
                this.setRenderBinDetails( 10, 'DepthSortedBin' );
            } else {
                this.setRenderBinDetails( 0, '' );
            }
        },

        setRenderBinDetails: function ( num, binName ) {
            this._binNumber = num;
            this._binName = binName;
        },
        getAttributeMap: function () {
            return this.attributeMap;
        },
        getBinNumber: function () {
            return this._binNumber;
        },
        getBinName: function () {
            return this._binName;
        },
        setBinNumber: function ( binNum ) {
            this._binNumber = binNum;
        },
        setBinName: function ( binName ) {
            this._binName = binName;
        },
        getAttributeList: function () {
            var attributes = this.attributeMap;
            var attributeMapKeys = attributes.getKeys();
            var attributeMapContent = attributes.getMapContent();
            var l = attributeMapKeys.length;
            var list = new Array( l );
            for ( var i = 0; i < l; i++ ) {
                list[ i ] = attributeMapContent[ attributeMapKeys[ i ] ];
            }
            return list;
        },
        setShaderGenerator: function ( generator ) {
            this._shaderGenerator = generator;
        },
        getShaderGenerator: function () {
            return this._shaderGenerator;
        },
        _getUniformMap: function () {
            return this.uniforms;
        },

        // for internal use, you should not call it directly
        _setTextureAttribute: function ( unit, attributePair ) {

            if ( this.textureAttributeMapList[ unit ] === undefined ) {
                this.textureAttributeMapList[ unit ] = new Map();
            }

            var name = attributePair.getAttribute().getTypeMember();
            var textureUnitAttributeMap = this.textureAttributeMapList[ unit ];

            var textureUnitAttributeMapContent = textureUnitAttributeMap.getMapContent();
            textureUnitAttributeMapContent[ name ] = attributePair;
            textureUnitAttributeMap.dirty();

        },

        // for internal use, you should not call it directly
        _setAttribute: function ( attributePair ) {

            var name = attributePair.getAttribute().getTypeMember();
            this.attributeMap.getMapContent()[ name ] = attributePair;
            this.attributeMap.dirty();

        }

    } ), 'osg', 'StateSet' );
    StateSet.prototype.setTextureAttributeAndModes = StateSet.prototype.setTextureAttributeAndMode;
    StateSet.prototype.setAttributeAndModes = StateSet.prototype.setAttributeAndMode;

    return StateSet;
} );

define( 'osg/NodeVisitor',[], function () {

    var NodeVisitor = function ( traversalMode ) {
        /*jshint bitwise: false */
        this.traversalMask = ~0x0;
        /*jshint bitwise: true */
        this.nodeMaskOverride = 0;
        this.traversalMode = traversalMode;
        if ( traversalMode === undefined ) {
            this.traversalMode = NodeVisitor.TRAVERSE_ALL_CHILDREN;
        }
        this.nodePath = [];
    };
    //NodeVisitor.TRAVERSE_NONE = 0;
    NodeVisitor.TRAVERSE_PARENTS = 1;
    NodeVisitor.TRAVERSE_ALL_CHILDREN = 2;
    NodeVisitor.TRAVERSE_ACTIVE_CHILDREN = 3;
    NodeVisitor._traversalFunctions = {};
    NodeVisitor._traversalFunctions[ NodeVisitor.TRAVERSE_PARENTS ] = function ( node ) {
        node.ascend( this );
    };
    NodeVisitor._traversalFunctions[ NodeVisitor.TRAVERSE_ALL_CHILDREN ] = function ( node ) {
        node.traverse( this );
    };
	NodeVisitor._traversalFunctions[ NodeVisitor.TRAVERSE_ACTIVE_CHILDREN ] = function ( node ) {
        node.traverse( this );
    };
	
	
    NodeVisitor._pushOntoNodePath = {};
    NodeVisitor._pushOntoNodePath[ NodeVisitor.TRAVERSE_PARENTS ] = function ( node ) {
        this.nodePath.unshift( node );
    };
    NodeVisitor._pushOntoNodePath[ NodeVisitor.TRAVERSE_ALL_CHILDREN ] = function ( node ) {
        this.nodePath.push( node );
    };
	NodeVisitor._pushOntoNodePath[ NodeVisitor.TRAVERSE_ACTIVE_CHILDREN ] = function ( node ) {
        this.nodePath.push( node );
    };
    NodeVisitor._popFromNodePath = {};
    NodeVisitor._popFromNodePath[ NodeVisitor.TRAVERSE_PARENTS ] = function () {
        return this.nodePath.shift();
    };
    NodeVisitor._popFromNodePath[ NodeVisitor.TRAVERSE_ALL_CHILDREN ] = function () {
        this.nodePath.pop();
    };
	NodeVisitor._popFromNodePath[ NodeVisitor.TRAVERSE_ACTIVE_CHILDREN ] = function () {
        this.nodePath.pop();
    };

    NodeVisitor.prototype = {
        setNodeMaskOverride: function ( m ) {
            this.nodeMaskOverride = m;
        },
        getNodeMaskOverride: function () {
            return this.nodeMaskOverride;
        },

        setTraversalMask: function ( m ) {
            this.traversalMask = m;
        },
        getTraversalMask: function () {
            return this.traversalMask;
        },

        pushOntoNodePath: function ( node ) {
            NodeVisitor._pushOntoNodePath[ this.traversalMode ].call( this, node );
        },
        popFromNodePath: function () {
            NodeVisitor._popFromNodePath[ this.traversalMode ].call( this );
        },
        validNodeMask: function ( node ) {
            var nm = node.getNodeMask();
            /*jshint bitwise: false */
            return ( ( this.traversalMask & ( this.nodeMaskOverride | nm ) ) !== 0 );
            /*jshint bitwise: true */
        },
        apply: function ( node ) {
            this.traverse( node );
        },
        traverse: function ( node ) {
            NodeVisitor._traversalFunctions[ this.traversalMode ].call( this, node );
        }
    };

    return NodeVisitor;
} );

define( 'osg/Quat',[
    'osg/Notify'
], function ( Notify ) {

    /** @class Quaternion Operations */
    var Quat = {
        create: function () {
            return [ 0.0, 0.0, 0.0, 1.0 ];
        },
        copy: function ( s, d ) {
            d[ 0 ] = s[ 0 ];
            d[ 1 ] = s[ 1 ];
            d[ 2 ] = s[ 2 ];
            d[ 3 ] = s[ 3 ];
            return d;
        },
        makeIdentity: function ( element ) {
            return Quat.init( element );
        },
        zeroRotation: function ( element ) {
            return Quat.init( element );
        },

        init: function ( element ) {
            element[ 0 ] = 0.0;
            element[ 1 ] = 0.0;
            element[ 2 ] = 0.0;
            element[ 3 ] = 1.0;
            return element;
        },

        sub: function ( a, b, result ) {
            result[ 0 ] = a[ 0 ] - b[ 0 ];
            result[ 1 ] = a[ 1 ] - b[ 1 ];
            result[ 2 ] = a[ 2 ] - b[ 2 ];
            result[ 3 ] = a[ 3 ] - b[ 3 ];
            return result;
        },

        add: function ( a, b, result ) {
            result[ 0 ] = a[ 0 ] + b[ 0 ];
            result[ 1 ] = a[ 1 ] + b[ 1 ];
            result[ 2 ] = a[ 2 ] + b[ 2 ];
            result[ 3 ] = a[ 3 ] + b[ 3 ];
            return result;
        },

        dot: function ( a, b ) {
            return a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ] + a[ 3 ] * b[ 3 ];
        },

        length2: function ( a ) {
            return a[ 0 ] * a[ 0 ] + a[ 1 ] * a[ 1 ] + a[ 2 ] * a[ 2 ] + a[ 3 ] * a[ 3 ];
        },

        neg: function ( a, result ) {
            result[ 0 ] = -a[ 0 ];
            result[ 1 ] = -a[ 1 ];
            result[ 2 ] = -a[ 2 ];
            result[ 3 ] = -a[ 3 ];
            return result;
        },

        makeRotate: function ( angle, x, y, z, result ) {
            if ( result === undefined ) {
                result = [ 0.0, 0.0, 0.0, 0.0 ];
            }

            var epsilon = 0.0000001;
            var length = Math.sqrt( x * x + y * y + z * z );
            if ( length < epsilon ) {
                return this.init( result );
            }

            var inversenorm = 1.0 / length;
            var coshalfangle = Math.cos( 0.5 * angle );
            var sinhalfangle = Math.sin( 0.5 * angle );

            result[ 0 ] = x * sinhalfangle * inversenorm;
            result[ 1 ] = y * sinhalfangle * inversenorm;
            result[ 2 ] = z * sinhalfangle * inversenorm;
            result[ 3 ] = coshalfangle;
            return result;
        },

        lerp: function ( t, a, b, r ) {
            r[ 0 ] = a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t;
            r[ 1 ] = a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t;
            r[ 2 ] = a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * t;
            r[ 3 ] = a[ 3 ] + ( b[ 3 ] - a[ 3 ] ) * t;
            return r;
        },

        slerp: function ( t, from, to, result ) {
            var epsilon = 0.00001;

            var quatTo = to;
            var cosomega = this.dot( from, quatTo );
            if ( cosomega < 0.0 ) {
                cosomega = -cosomega;
                this.neg( to, quatTo );
            }

            var omega;
            var sinomega;
            var scaleFrom;
            var scaleTo;
            if ( ( 1.0 - cosomega ) > epsilon ) {
                omega = Math.acos( cosomega ); // 0 <= omega <= Pi (see man acos)
                sinomega = Math.sin( omega ); // this sinomega should always be +ve so
                // could try sinomega=sqrt(1-cosomega*cosomega) to avoid a sin()?
                scaleFrom = Math.sin( ( 1.0 - t ) * omega ) / sinomega;
                scaleTo = Math.sin( t * omega ) / sinomega;
            } else {
                /* --------------------------------------------------
             The ends of the vectors are very close
             we can use simple linear interpolation - no need
             to worry about the 'spherical' interpolation
             -------------------------------------------------- */
                scaleFrom = 1.0 - t;
                scaleTo = t;
            }

            result[ 0 ] = from[ 0 ] * scaleFrom + quatTo[ 0 ] * scaleTo;
            result[ 1 ] = from[ 1 ] * scaleFrom + quatTo[ 1 ] * scaleTo;
            result[ 2 ] = from[ 2 ] * scaleFrom + quatTo[ 2 ] * scaleTo;
            result[ 3 ] = from[ 3 ] * scaleFrom + quatTo[ 3 ] * scaleTo;
            return result;
        },

        // transformVec3: function (q, vec, result) {
        //     // nVidia SDK implementation
        //     var uv = new Array(3);
        //     var uuv = new Array(3);
        //     Vec3.cross(q, vec, uv);
        //     Vec3.cross(q, uv, result);
        //     Vec3.mult(uv, 2.0 * q[3], uv);
        //     Vec3.mult(result, 2.0, result);
        //     Vec3.add(result, uv, result);
        //     Vec3.add(result, vec, result);
        //     return result;
        // },

        normalize: function ( q, qr ) {
            var div = 1.0 / this.length2( q );
            qr[ 0 ] = q[ 0 ] * div;
            qr[ 1 ] = q[ 1 ] * div;
            qr[ 2 ] = q[ 2 ] * div;
            qr[ 3 ] = q[ 3 ] * div;
            return qr;
        },

        // we suppose to have unit quaternion
        conj: function ( a, result ) {
            result[ 0 ] = -a[ 0 ];
            result[ 1 ] = -a[ 1 ];
            result[ 2 ] = -a[ 2 ];
            result[ 3 ] = a[ 3 ];
            return result;
        },

        inverse: function ( a, result ) {
            var div = 1.0 / this.length2( a );
            this.conj( a, result );
            result[ 0 ] *= div;
            result[ 1 ] *= div;
            result[ 2 ] *= div;
            result[ 3 ] *= div;
            return result;
        },

        // we suppose to have unit quaternion
        // multiply 2 quaternions
        mult: function ( a, b, result ) {
            result[ 0 ] = a[ 0 ] * b[ 3 ] + a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ] + a[ 3 ] * b[ 0 ];
            result[ 1 ] = -a[ 0 ] * b[ 2 ] + a[ 1 ] * b[ 3 ] + a[ 2 ] * b[ 0 ] + a[ 3 ] * b[ 1 ];
            result[ 2 ] = a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] + a[ 2 ] * b[ 3 ] + a[ 3 ] * b[ 2 ];
            result[ 3 ] = -a[ 0 ] * b[ 0 ] - a[ 1 ] * b[ 1 ] - a[ 2 ] * b[ 2 ] + a[ 3 ] * b[ 3 ];
            return result;
        },
        div: function ( a, b, result ) {
            var d = 1.0 / b;
            result[ 0 ] = a[ 0 ] * d;
            result[ 1 ] = a[ 1 ] * d;
            result[ 2 ] = a[ 2 ] * d;
            result[ 3 ] = a[ 3 ] * d;
            return result;
        },
        exp: function ( a, res ) {
            var r = Math.sqrt( a[ 0 ] * a[ 0 ] + a[ 1 ] * a[ 1 ] + a[ 2 ] * a[ 2 ] );
            var et = Math.exp( a[ 3 ] );
            var s = 0;
            if ( r > 0.00001 ) {
                s = et * Math.sin( r ) / r;
            }
            if ( res === undefined ) {
                Notify.warn( 'no quat destination !' );
                res = Quat.create();
            }
            res[ 0 ] = s * a[ 0 ];
            res[ 1 ] = s * a[ 1 ];
            res[ 2 ] = s * a[ 2 ];
            res[ 3 ] = et * Math.cos( r );
            return res;
        },

        ln: function ( a, res ) {
            var n = a[ 0 ] * a[ 0 ] + a[ 1 ] * a[ 1 ] + a[ 2 ] * a[ 2 ];
            var r = Math.sqrt( n );
            var t = 0;
            if ( r > 0.00001 ) {
                t = Math.atan2( r, a[ 3 ] ) / r;
            }
            if ( res === undefined ) {
                Notify.warn( 'no quat destination !' );
                res = Quat.create();
            }
            n += a[ 3 ] * a[ 3 ];
            res[ 0 ] = t * a[ 0 ];
            res[ 1 ] = t * a[ 1 ];
            res[ 2 ] = t * a[ 2 ];
            res[ 3 ] = 0.5 * Math.log( n );
            return res;
        },


        //http://theory.org/software/qfa/writeup/node12.html
        //http://www.ece.uwaterloo.ca/~dwharder/C++/CQOST/src/
        //http://willperone.net/Code/quaternion.php

        // a is computeTangent(q1-1,q1,q2)
        // b is computeTangent(q2-1,q2,q2+1)
        squad: function ( t, q1, a, b, q2, r ) {
            var r1 = this.slerp( t, q1, q2 );
            var r2 = this.slerp( t, a, b );
            return this.slerp( 2.0 * t * ( 1.0 - t ), r1, r2, r );
        },

        // qcur is current
        // q0 is qcur-1
        // q2 is qcur+1
        // compute tangent in of q1
        computeTangent: function ( q0, qcur, q2, r ) {

            // first step
            var invq = this.inv( qcur );
            var qa, qb;

            this.mult( q2, invq, qa );
            this.ln( qa, qa );

            this.mult( q0, invq, qb );
            this.ln( qb, qb );

            this.add( qa, qb, qa );
            this.div( qa, -4.0, qa );
            this.exp( qa, qb );
            return this.mult( qb, qcur, r );
        }

    };

    return Quat;
} );

define( 'osg/Matrix',[
    'osg/Notify',
    'osg/Vec3',
    'osg/Vec4',
    'osg/Quat'
], function ( Notify, Vec3, Vec4, Quat ) {

    /** @class Matrix Operations */
    var Matrix = {

        create: function () {
            return [ 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0 ];
        },

        valid: function ( matrix ) {
            for ( var i = 0; i < 16; i++ ) {
                if ( isNaN( matrix[ i ] ) ) {
                    return false;
                }
            }
            return true;
        },
        setRow: function ( matrix, row, v0, v1, v2, v3 ) {
            var rowIndex = row * 4;
            matrix[ rowIndex + 0 ] = v0;
            matrix[ rowIndex + 1 ] = v1;
            matrix[ rowIndex + 2 ] = v2;
            matrix[ rowIndex + 3 ] = v3;
        },
        innerProduct: function ( a, b, r, c ) {
            var rIndex = r * 4;
            return ( ( a[ rIndex + 0 ] * b[ 0 + c ] ) + ( a[ rIndex + 1 ] * b[ 4 + c ] ) + ( a[ rIndex + 2 ] * b[ 8 + c ] ) + ( a[ rIndex + 3 ] * b[ 12 + c ] ) );
        },

        set: function ( matrix, row, col, value ) {
            matrix[ row * 4 + col ] = value;
            return value;
        },

        get: function ( matrix, row, col ) {
            return matrix[ row * 4 + col ];
        },

        makeIdentity: function ( matrix ) {
            if ( matrix === undefined ) {
                Notify.warn( 'no matrix destination !' );
                return Matrix.create();
            }
            Matrix.setRow( matrix, 0, 1.0, 0.0, 0.0, 0.0 );
            Matrix.setRow( matrix, 1, 0.0, 1.0, 0.0, 0.0 );
            Matrix.setRow( matrix, 2, 0.0, 0.0, 1.0, 0.0 );
            Matrix.setRow( matrix, 3, 0.0, 0.0, 0.0, 1.0 );
            return matrix;
        },

        /**
         * @param {Number} x position
         * @param {Number} y position
         * @param {Number} z position
         * @param {Array} matrix to write result
         */
        makeTranslate: function ( x, y, z, matrix ) {
            if ( matrix === undefined ) {
                Notify.warn( 'no matrix destination !' );
                matrix = Matrix.create();
                Matrix.setRow( matrix, 3, x, y, z, 1.0 );
                return matrix;
            }
            Matrix.setRow( matrix, 0, 1.0, 0.0, 0.0, 0.0 );
            Matrix.setRow( matrix, 1, 0.0, 1.0, 0.0, 0.0 );
            Matrix.setRow( matrix, 2, 0.0, 0.0, 1.0, 0.0 );
            Matrix.setRow( matrix, 3, x, y, z, 1.0 );
            return matrix;
        },

        setTrans: function ( matrix, x, y, z ) {
            matrix[ 12 ] = x;
            matrix[ 13 ] = y;
            matrix[ 14 ] = z;
            return matrix;
        },

        getTrans: function ( matrix, result ) {
            result[ 0 ] = matrix[ 12 ];
            result[ 1 ] = matrix[ 13 ];
            result[ 2 ] = matrix[ 14 ];
            return result;
        },

        // do a * b and result in a
        preMult: function ( a, b ) {
            var atmp0, atmp1, atmp2, atmp3;

            atmp0 = ( b[ 0 ] * a[ 0 ] ) + ( b[ 1 ] * a[ 4 ] ) + ( b[ 2 ] * a[ 8 ] ) + ( b[ 3 ] * a[ 12 ] );
            atmp1 = ( b[ 4 ] * a[ 0 ] ) + ( b[ 5 ] * a[ 4 ] ) + ( b[ 6 ] * a[ 8 ] ) + ( b[ 7 ] * a[ 12 ] );
            atmp2 = ( b[ 8 ] * a[ 0 ] ) + ( b[ 9 ] * a[ 4 ] ) + ( b[ 10 ] * a[ 8 ] ) + ( b[ 11 ] * a[ 12 ] );
            atmp3 = ( b[ 12 ] * a[ 0 ] ) + ( b[ 13 ] * a[ 4 ] ) + ( b[ 14 ] * a[ 8 ] ) + ( b[ 15 ] * a[ 12 ] );
            a[ 0 ] = atmp0;
            a[ 4 ] = atmp1;
            a[ 8 ] = atmp2;
            a[ 12 ] = atmp3;

            atmp0 = ( b[ 0 ] * a[ 1 ] ) + ( b[ 1 ] * a[ 5 ] ) + ( b[ 2 ] * a[ 9 ] ) + ( b[ 3 ] * a[ 13 ] );
            atmp1 = ( b[ 4 ] * a[ 1 ] ) + ( b[ 5 ] * a[ 5 ] ) + ( b[ 6 ] * a[ 9 ] ) + ( b[ 7 ] * a[ 13 ] );
            atmp2 = ( b[ 8 ] * a[ 1 ] ) + ( b[ 9 ] * a[ 5 ] ) + ( b[ 10 ] * a[ 9 ] ) + ( b[ 11 ] * a[ 13 ] );
            atmp3 = ( b[ 12 ] * a[ 1 ] ) + ( b[ 13 ] * a[ 5 ] ) + ( b[ 14 ] * a[ 9 ] ) + ( b[ 15 ] * a[ 13 ] );
            a[ 1 ] = atmp0;
            a[ 5 ] = atmp1;
            a[ 9 ] = atmp2;
            a[ 13 ] = atmp3;

            atmp0 = ( b[ 0 ] * a[ 2 ] ) + ( b[ 1 ] * a[ 6 ] ) + ( b[ 2 ] * a[ 10 ] ) + ( b[ 3 ] * a[ 14 ] );
            atmp1 = ( b[ 4 ] * a[ 2 ] ) + ( b[ 5 ] * a[ 6 ] ) + ( b[ 6 ] * a[ 10 ] ) + ( b[ 7 ] * a[ 14 ] );
            atmp2 = ( b[ 8 ] * a[ 2 ] ) + ( b[ 9 ] * a[ 6 ] ) + ( b[ 10 ] * a[ 10 ] ) + ( b[ 11 ] * a[ 14 ] );
            atmp3 = ( b[ 12 ] * a[ 2 ] ) + ( b[ 13 ] * a[ 6 ] ) + ( b[ 14 ] * a[ 10 ] ) + ( b[ 15 ] * a[ 14 ] );
            a[ 2 ] = atmp0;
            a[ 6 ] = atmp1;
            a[ 10 ] = atmp2;
            a[ 14 ] = atmp3;

            atmp0 = ( b[ 0 ] * a[ 3 ] ) + ( b[ 1 ] * a[ 7 ] ) + ( b[ 2 ] * a[ 11 ] ) + ( b[ 3 ] * a[ 15 ] );
            atmp1 = ( b[ 4 ] * a[ 3 ] ) + ( b[ 5 ] * a[ 7 ] ) + ( b[ 6 ] * a[ 11 ] ) + ( b[ 7 ] * a[ 15 ] );
            atmp2 = ( b[ 8 ] * a[ 3 ] ) + ( b[ 9 ] * a[ 7 ] ) + ( b[ 10 ] * a[ 11 ] ) + ( b[ 11 ] * a[ 15 ] );
            atmp3 = ( b[ 12 ] * a[ 3 ] ) + ( b[ 13 ] * a[ 7 ] ) + ( b[ 14 ] * a[ 11 ] ) + ( b[ 15 ] * a[ 15 ] );
            a[ 3 ] = atmp0;
            a[ 7 ] = atmp1;
            a[ 11 ] = atmp2;
            a[ 15 ] = atmp3;

            return a;
        },

        // do a * b and result in b
        postMult: function ( a, b ) {
            var btmp0, btmp1, btmp2, btmp3;
            // post mult
            btmp0 = ( b[ 0 ] * a[ 0 ] ) + ( b[ 1 ] * a[ 4 ] ) + ( b[ 2 ] * a[ 8 ] ) + ( b[ 3 ] * a[ 12 ] );
            btmp1 = ( b[ 0 ] * a[ 1 ] ) + ( b[ 1 ] * a[ 5 ] ) + ( b[ 2 ] * a[ 9 ] ) + ( b[ 3 ] * a[ 13 ] );
            btmp2 = ( b[ 0 ] * a[ 2 ] ) + ( b[ 1 ] * a[ 6 ] ) + ( b[ 2 ] * a[ 10 ] ) + ( b[ 3 ] * a[ 14 ] );
            btmp3 = ( b[ 0 ] * a[ 3 ] ) + ( b[ 1 ] * a[ 7 ] ) + ( b[ 2 ] * a[ 11 ] ) + ( b[ 3 ] * a[ 15 ] );
            b[ 0 ] = btmp0;
            b[ 1 ] = btmp1;
            b[ 2 ] = btmp2;
            b[ 3 ] = btmp3;

            btmp0 = ( b[ 4 ] * a[ 0 ] ) + ( b[ 5 ] * a[ 4 ] ) + ( b[ 6 ] * a[ 8 ] ) + ( b[ 7 ] * a[ 12 ] );
            btmp1 = ( b[ 4 ] * a[ 1 ] ) + ( b[ 5 ] * a[ 5 ] ) + ( b[ 6 ] * a[ 9 ] ) + ( b[ 7 ] * a[ 13 ] );
            btmp2 = ( b[ 4 ] * a[ 2 ] ) + ( b[ 5 ] * a[ 6 ] ) + ( b[ 6 ] * a[ 10 ] ) + ( b[ 7 ] * a[ 14 ] );
            btmp3 = ( b[ 4 ] * a[ 3 ] ) + ( b[ 5 ] * a[ 7 ] ) + ( b[ 6 ] * a[ 11 ] ) + ( b[ 7 ] * a[ 15 ] );
            b[ 4 ] = btmp0;
            b[ 5 ] = btmp1;
            b[ 6 ] = btmp2;
            b[ 7 ] = btmp3;

            btmp0 = ( b[ 8 ] * a[ 0 ] ) + ( b[ 9 ] * a[ 4 ] ) + ( b[ 10 ] * a[ 8 ] ) + ( b[ 11 ] * a[ 12 ] );
            btmp1 = ( b[ 8 ] * a[ 1 ] ) + ( b[ 9 ] * a[ 5 ] ) + ( b[ 10 ] * a[ 9 ] ) + ( b[ 11 ] * a[ 13 ] );
            btmp2 = ( b[ 8 ] * a[ 2 ] ) + ( b[ 9 ] * a[ 6 ] ) + ( b[ 10 ] * a[ 10 ] ) + ( b[ 11 ] * a[ 14 ] );
            btmp3 = ( b[ 8 ] * a[ 3 ] ) + ( b[ 9 ] * a[ 7 ] ) + ( b[ 10 ] * a[ 11 ] ) + ( b[ 11 ] * a[ 15 ] );
            b[ 8 ] = btmp0;
            b[ 9 ] = btmp1;
            b[ 10 ] = btmp2;
            b[ 11 ] = btmp3;

            btmp0 = ( b[ 12 ] * a[ 0 ] ) + ( b[ 13 ] * a[ 4 ] ) + ( b[ 14 ] * a[ 8 ] ) + ( b[ 15 ] * a[ 12 ] );
            btmp1 = ( b[ 12 ] * a[ 1 ] ) + ( b[ 13 ] * a[ 5 ] ) + ( b[ 14 ] * a[ 9 ] ) + ( b[ 15 ] * a[ 13 ] );
            btmp2 = ( b[ 12 ] * a[ 2 ] ) + ( b[ 13 ] * a[ 6 ] ) + ( b[ 14 ] * a[ 10 ] ) + ( b[ 15 ] * a[ 14 ] );
            btmp3 = ( b[ 12 ] * a[ 3 ] ) + ( b[ 13 ] * a[ 7 ] ) + ( b[ 14 ] * a[ 11 ] ) + ( b[ 15 ] * a[ 15 ] );
            b[ 12 ] = btmp0;
            b[ 13 ] = btmp1;
            b[ 14 ] = btmp2;
            b[ 15 ] = btmp3;

            return b;
        },
        multa: function ( a, b, r ) {
            if ( r === a ) {
                return Matrix.preMult( a, b );
            } else if ( r === b ) {
                return Matrix.postMult( a, b );
            } else {
                if ( r === undefined ) {
                    Notify.warn( 'no matrix destination !' );
                    r = Matrix.create();
                }
                r[ 0 ] = b[ 0 ] * a[ 0 ] + b[ 1 ] * a[ 4 ] + b[ 2 ] * a[ 8 ] + b[ 3 ] * a[ 12 ];
                r[ 1 ] = b[ 0 ] * a[ 1 ] + b[ 1 ] * a[ 5 ] + b[ 2 ] * a[ 9 ] + b[ 3 ] * a[ 13 ];
                r[ 2 ] = b[ 0 ] * a[ 2 ] + b[ 1 ] * a[ 6 ] + b[ 2 ] * a[ 10 ] + b[ 3 ] * a[ 14 ];
                r[ 3 ] = b[ 0 ] * a[ 3 ] + b[ 1 ] * a[ 7 ] + b[ 2 ] * a[ 11 ] + b[ 3 ] * a[ 15 ];

                r[ 4 ] = b[ 4 ] * a[ 0 ] + b[ 5 ] * a[ 4 ] + b[ 6 ] * a[ 8 ] + b[ 7 ] * a[ 12 ];
                r[ 5 ] = b[ 4 ] * a[ 1 ] + b[ 5 ] * a[ 5 ] + b[ 6 ] * a[ 9 ] + b[ 7 ] * a[ 13 ];
                r[ 6 ] = b[ 4 ] * a[ 2 ] + b[ 5 ] * a[ 6 ] + b[ 6 ] * a[ 10 ] + b[ 7 ] * a[ 14 ];
                r[ 7 ] = b[ 4 ] * a[ 3 ] + b[ 5 ] * a[ 7 ] + b[ 6 ] * a[ 11 ] + b[ 7 ] * a[ 15 ];

                r[ 8 ] = b[ 8 ] * a[ 0 ] + b[ 9 ] * a[ 4 ] + b[ 10 ] * a[ 8 ] + b[ 11 ] * a[ 12 ];
                r[ 9 ] = b[ 8 ] * a[ 1 ] + b[ 9 ] * a[ 5 ] + b[ 10 ] * a[ 9 ] + b[ 11 ] * a[ 13 ];
                r[ 10 ] = b[ 8 ] * a[ 2 ] + b[ 9 ] * a[ 6 ] + b[ 10 ] * a[ 10 ] + b[ 11 ] * a[ 14 ];
                r[ 11 ] = b[ 8 ] * a[ 3 ] + b[ 9 ] * a[ 7 ] + b[ 10 ] * a[ 11 ] + b[ 11 ] * a[ 15 ];

                r[ 12 ] = b[ 12 ] * a[ 0 ] + b[ 13 ] * a[ 4 ] + b[ 14 ] * a[ 8 ] + b[ 15 ] * a[ 12 ];
                r[ 13 ] = b[ 12 ] * a[ 1 ] + b[ 13 ] * a[ 5 ] + b[ 14 ] * a[ 9 ] + b[ 15 ] * a[ 13 ];
                r[ 14 ] = b[ 12 ] * a[ 2 ] + b[ 13 ] * a[ 6 ] + b[ 14 ] * a[ 10 ] + b[ 15 ] * a[ 14 ];
                r[ 15 ] = b[ 12 ] * a[ 3 ] + b[ 13 ] * a[ 7 ] + b[ 14 ] * a[ 11 ] + b[ 15 ] * a[ 15 ];

                return r;
            }
        },
        /* r = a * b */
        mult: function ( a, b, r ) {
            var s00 = b[ 0 ];
            var s01 = b[ 1 ];
            var s02 = b[ 2 ];
            var s03 = b[ 3 ];
            var s10 = b[ 4 ];
            var s11 = b[ 5 ];
            var s12 = b[ 6 ];
            var s13 = b[ 7 ];
            var s20 = b[ 8 ];
            var s21 = b[ 9 ];
            var s22 = b[ 10 ];
            var s23 = b[ 11 ];
            var s30 = b[ 12 ];
            var s31 = b[ 13 ];
            var s32 = b[ 14 ];
            var s33 = b[ 15 ];

            var o00 = a[ 0 ];
            var o01 = a[ 1 ];
            var o02 = a[ 2 ];
            var o03 = a[ 3 ];
            var o10 = a[ 4 ];
            var o11 = a[ 5 ];
            var o12 = a[ 6 ];
            var o13 = a[ 7 ];
            var o20 = a[ 8 ];
            var o21 = a[ 9 ];
            var o22 = a[ 10 ];
            var o23 = a[ 11 ];
            var o30 = a[ 12 ];
            var o31 = a[ 13 ];
            var o32 = a[ 14 ];
            var o33 = a[ 15 ];

            r[ 0 ] = s00 * o00 + s01 * o10 + s02 * o20 + s03 * o30;
            r[ 1 ] = s00 * o01 + s01 * o11 + s02 * o21 + s03 * o31;
            r[ 2 ] = s00 * o02 + s01 * o12 + s02 * o22 + s03 * o32;
            r[ 3 ] = s00 * o03 + s01 * o13 + s02 * o23 + s03 * o33;

            r[ 4 ] = s10 * o00 + s11 * o10 + s12 * o20 + s13 * o30;
            r[ 5 ] = s10 * o01 + s11 * o11 + s12 * o21 + s13 * o31;
            r[ 6 ] = s10 * o02 + s11 * o12 + s12 * o22 + s13 * o32;
            r[ 7 ] = s10 * o03 + s11 * o13 + s12 * o23 + s13 * o33;

            r[ 8 ] = s20 * o00 + s21 * o10 + s22 * o20 + s23 * o30;
            r[ 9 ] = s20 * o01 + s21 * o11 + s22 * o21 + s23 * o31;
            r[ 10 ] = s20 * o02 + s21 * o12 + s22 * o22 + s23 * o32;
            r[ 11 ] = s20 * o03 + s21 * o13 + s22 * o23 + s23 * o33;

            r[ 12 ] = s30 * o00 + s31 * o10 + s32 * o20 + s33 * o30;
            r[ 13 ] = s30 * o01 + s31 * o11 + s32 * o21 + s33 * o31;
            r[ 14 ] = s30 * o02 + s31 * o12 + s32 * o22 + s33 * o32;
            r[ 15 ] = s30 * o03 + s31 * o13 + s32 * o23 + s33 * o33;

            return r;
        },
        multOrig: function ( a, b, r ) {
            var inner1 = 0.0,
                inner2 = 0.0,
                inner3 = 0.0,
                inner4 = 0.0;
            if ( r === a ) {
                // pre mult
                for ( var col = 0; col < 4; col++ ) {
                    inner1 = Matrix.innerProduct( b, a, 0, col );
                    inner2 = Matrix.innerProduct( b, a, 1, col );
                    inner3 = Matrix.innerProduct( b, a, 2, col );
                    inner4 = Matrix.innerProduct( b, a, 3, col );
                    a[ 0 + col ] = inner1;
                    a[ 4 + col ] = inner2;
                    a[ 8 + col ] = inner3;
                    a[ 12 + col ] = inner4;
                }
                return a;
                //return Matrix.preMult(r, b);
            } else if ( r === b ) {
                // post mult
                for ( var row = 0; row < 4; row++ ) {
                    inner1 = Matrix.innerProduct( b, a, row, 0 );
                    inner2 = Matrix.innerProduct( b, a, row, 1 );
                    inner3 = Matrix.innerProduct( b, a, row, 2 );
                    inner4 = Matrix.innerProduct( b, a, row, 3 );
                    Matrix.setRow( b, row, inner1, inner2, inner3, inner4 );
                }
                return b;
                //return Matrix.postMult(r, a);
            }
            if ( r === undefined ) {
                Notify.warn( 'no matrix destination !' );
                r = Matrix.create();
            }

            var s00 = b[ 0 ];
            var s01 = b[ 1 ];
            var s02 = b[ 2 ];
            var s03 = b[ 3 ];
            var s10 = b[ 4 ];
            var s11 = b[ 5 ];
            var s12 = b[ 6 ];
            var s13 = b[ 7 ];
            var s20 = b[ 8 ];
            var s21 = b[ 9 ];
            var s22 = b[ 10 ];
            var s23 = b[ 11 ];
            var s30 = b[ 12 ];
            var s31 = b[ 13 ];
            var s32 = b[ 14 ];
            var s33 = b[ 15 ];

            var o00 = a[ 0 ];
            var o01 = a[ 1 ];
            var o02 = a[ 2 ];
            var o03 = a[ 3 ];
            var o10 = a[ 4 ];
            var o11 = a[ 5 ];
            var o12 = a[ 6 ];
            var o13 = a[ 7 ];
            var o20 = a[ 8 ];
            var o21 = a[ 9 ];
            var o22 = a[ 10 ];
            var o23 = a[ 11 ];
            var o30 = a[ 12 ];
            var o31 = a[ 13 ];
            var o32 = a[ 14 ];
            var o33 = a[ 15 ];

            r[ 0 ] = s00 * o00 + s01 * o10 + s02 * o20 + s03 * o30;
            r[ 1 ] = s00 * o01 + s01 * o11 + s02 * o21 + s03 * o31;
            r[ 2 ] = s00 * o02 + s01 * o12 + s02 * o22 + s03 * o32;
            r[ 3 ] = s00 * o03 + s01 * o13 + s02 * o23 + s03 * o33;

            r[ 4 ] = s10 * o00 + s11 * o10 + s12 * o20 + s13 * o30;
            r[ 5 ] = s10 * o01 + s11 * o11 + s12 * o21 + s13 * o31;
            r[ 6 ] = s10 * o02 + s11 * o12 + s12 * o22 + s13 * o32;
            r[ 7 ] = s10 * o03 + s11 * o13 + s12 * o23 + s13 * o33;

            r[ 8 ] = s20 * o00 + s21 * o10 + s22 * o20 + s23 * o30;
            r[ 9 ] = s20 * o01 + s21 * o11 + s22 * o21 + s23 * o31;
            r[ 10 ] = s20 * o02 + s21 * o12 + s22 * o22 + s23 * o32;
            r[ 11 ] = s20 * o03 + s21 * o13 + s22 * o23 + s23 * o33;

            r[ 12 ] = s30 * o00 + s31 * o10 + s32 * o20 + s33 * o30;
            r[ 13 ] = s30 * o01 + s31 * o11 + s32 * o21 + s33 * o31;
            r[ 14 ] = s30 * o02 + s31 * o12 + s32 * o22 + s33 * o32;
            r[ 15 ] = s30 * o03 + s31 * o13 + s32 * o23 + s33 * o33;

            return r;
        },

        makeLookAt: ( function () {
            var f = [ 0.0, 0.0, 0.0 ];
            var s = [ 0.0, 0.0, 0.0 ];
            var u = [ 0.0, 0.0, 0.0 ];
            var neg = [ 0.0, 0.0, 0.0 ];

            return function ( eye, center, up, result ) {
                if ( result === undefined ) {
                    Notify.warn( 'no matrix destination !' );
                    result = Matrix.create();
                }

                Vec3.sub( center, eye, f );
                Vec3.normalize( f, f );

                Vec3.cross( f, up, s );
                Vec3.normalize( s, s );

                Vec3.cross( s, f, u );
                Vec3.normalize( u, u );

                // s[0], u[0], -f[0], 0.0,
                // s[1], u[1], -f[1], 0.0,
                // s[2], u[2], -f[2], 0.0,
                // 0,    0,    0,     1.0

                result[ 0 ] = s[ 0 ];
                result[ 1 ] = u[ 0 ];
                result[ 2 ] = -f[ 0 ];
                result[ 3 ] = 0.0;
                result[ 4 ] = s[ 1 ];
                result[ 5 ] = u[ 1 ];
                result[ 6 ] = -f[ 1 ];
                result[ 7 ] = 0.0;
                result[ 8 ] = s[ 2 ];
                result[ 9 ] = u[ 2 ];
                result[ 10 ] = -f[ 2 ];
                result[ 11 ] = 0.0;
                result[ 12 ] = 0;
                result[ 13 ] = 0;
                result[ 14 ] = 0;
                result[ 15 ] = 1.0;

                Matrix.multTranslate( result, Vec3.neg( eye, neg ), result );
                return result;
            };
        } )(),
        makeOrtho: function ( left, right, bottom, top, zNear, zFar, result ) {
            if ( result === undefined ) {
                Notify.warn( 'no matrix destination !' );
                result = Matrix.create();
            }
            // note transpose of Matrix_implementation wr.t OpenGL documentation, since the OSG use post multiplication rather than pre.
            // we will change this convention later
            var tx = -( right + left ) / ( right - left );
            var ty = -( top + bottom ) / ( top - bottom );
            var tz = -( zFar + zNear ) / ( zFar - zNear );
            var row = Matrix.setRow;
            row( result, 0, 2.0 / ( right - left ), 0.0, 0.0, 0.0 );
            row( result, 1, 0.0, 2.0 / ( top - bottom ), 0.0, 0.0 );
            row( result, 2, 0.0, 0.0, -2.0 / ( zFar - zNear ), 0.0 );
            row( result, 3, tx, ty, tz, 1.0 );
            return result;
        },

        getLookAt: ( function () {
            var inv = [ 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0 ];
            var v1 = [ 0.0, 0.0, 0.0 ];
            var v2 = [ 0.0, 1.0, 0.0 ];
            var v3 = [ 0.0, 0.0, -1.0 ];

            return function ( matrix, eye, center, up, distance ) {
                if ( distance === undefined ) {
                    distance = 1.0;
                }
                var result = Matrix.inverse( matrix, inv );
                if ( !result ) {
                    Matrix.makeIdentity( inv );
                }
                Matrix.transformVec3( inv, v1, eye );
                Matrix.transform3x3( matrix, v2, up );
                Matrix.transform3x3( matrix, v3, center );
                Vec3.normalize( center, center );
                Vec3.add( Vec3.mult( center, distance, v1 ), eye, center );
            };
        } )(),

        //getRotate_David_Spillings_Mk1
        getRotate: ( function () {
            var tq = [ 0.0, 0.0, 0.0, 0.0 ];

            return function ( mat, quatResult ) {
                if ( quatResult === undefined ) {
                    Notify.warn( 'no quat destination !' );
                    quatResult = [ 0.0, 0.0, 0.0, 0.0 ];
                }

                var s;
                var i, j;

                // Use tq to store the largest trace
                var mat00 = mat[ 4 * 0 + 0 ];
                var mat11 = mat[ 4 * 1 + 1 ];
                var mat22 = mat[ 4 * 2 + 2 ];
                tq[ 0 ] = 1.0 + mat00 + mat11 + mat22;
                tq[ 1 ] = 1.0 + mat00 - mat11 - mat22;
                tq[ 2 ] = 1.0 - mat00 + mat11 - mat22;
                tq[ 3 ] = 1.0 - mat00 - mat11 + mat22;

                // Find the maximum (could also use stacked if's later)
                j = 0;
                for ( i = 1; i < 4; i++ ) {
                    if ( ( tq[ i ] > tq[ j ] ) ) {
                        j = i;
                    } else {
                        j = j;
                    }
                }

                // check the diagonal
                if ( j === 0 ) {
                    /* perform instant calculation */
                    quatResult[ 3 ] = tq[ 0 ];
                    quatResult[ 0 ] = mat[ 1 * 4 + 2 ] - mat[ 2 * 4 + 1 ];
                    quatResult[ 1 ] = mat[ 2 * 4 + 0 ] - mat[ 0 + 2 ];
                    quatResult[ 2 ] = mat[ 0 + 1 ] - mat[ 1 * 4 + 0 ];
                } else if ( j === 1 ) {
                    quatResult[ 3 ] = mat[ 1 * 4 + 2 ] - mat[ 2 * 4 + 1 ];
                    quatResult[ 0 ] = tq[ 1 ];
                    quatResult[ 1 ] = mat[ 0 + 1 ] + mat[ 1 * 4 + 0 ];
                    quatResult[ 2 ] = mat[ 2 * 4 + 0 ] + mat[ 0 + 2 ];
                } else if ( j === 2 ) {
                    quatResult[ 3 ] = mat[ 2 * 4 + 0 ] - mat[ 0 + 2 ];
                    quatResult[ 0 ] = mat[ 0 + 1 ] + mat[ 1 * 4 + 0 ];
                    quatResult[ 1 ] = tq[ 2 ];
                    quatResult[ 2 ] = mat[ 1 * 4 + 2 ] + mat[ 2 * 4 + 1 ];
                } else /* if (j==3) */ {
                    quatResult[ 3 ] = mat[ 0 + 1 ] - mat[ 1 * 4 + 0 ];
                    quatResult[ 0 ] = mat[ 2 * 4 + 0 ] + mat[ 0 + 2 ];
                    quatResult[ 1 ] = mat[ 1 * 4 + 2 ] + mat[ 2 * 4 + 1 ];
                    quatResult[ 2 ] = tq[ 3 ];
                }

                s = Math.sqrt( 0.25 / tq[ j ] );
                quatResult[ 3 ] *= s;
                quatResult[ 0 ] *= s;
                quatResult[ 1 ] *= s;
                quatResult[ 2 ] *= s;

                return quatResult;
            };
        } )(),

        // Matrix M = Matrix M * Matrix Translate
        preMultTranslate: function ( mat, translate ) {
            var val;
            if ( translate[ 0 ] !== 0.0 ) {
                val = translate[ 0 ];
                mat[ 12 ] += val * mat[ 0 ];
                mat[ 13 ] += val * mat[ 1 ];
                mat[ 14 ] += val * mat[ 2 ];
                mat[ 15 ] += val * mat[ 3 ];
            }

            if ( translate[ 1 ] !== 0.0 ) {
                val = translate[ 1 ];
                mat[ 12 ] += val * mat[ 4 ];
                mat[ 13 ] += val * mat[ 5 ];
                mat[ 14 ] += val * mat[ 6 ];
                mat[ 15 ] += val * mat[ 7 ];
            }

            if ( translate[ 2 ] !== 0.0 ) {
                val = translate[ 2 ];
                mat[ 12 ] += val * mat[ 8 ];
                mat[ 13 ] += val * mat[ 9 ];
                mat[ 14 ] += val * mat[ 10 ];
                mat[ 15 ] += val * mat[ 11 ];
            }
            return mat;
        },

        // result = Matrix M * Matrix Translate
        multTranslate: function ( mat, translate, result ) {
            if ( result === undefined ) {
                Notify.warn( 'no matrix destination !' );
                result = Matrix.create();
            }
            if ( result !== mat ) {
                Matrix.copy( mat, result );
            }

            var val;
            if ( translate[ 0 ] !== 0.0 ) {
                val = translate[ 0 ];
                result[ 12 ] += val * mat[ 0 ];
                result[ 13 ] += val * mat[ 1 ];
                result[ 14 ] += val * mat[ 2 ];
                result[ 15 ] += val * mat[ 3 ];
            }

            if ( translate[ 1 ] !== 0.0 ) {
                val = translate[ 1 ];
                result[ 12 ] += val * mat[ 4 ];
                result[ 13 ] += val * mat[ 5 ];
                result[ 14 ] += val * mat[ 6 ];
                result[ 15 ] += val * mat[ 7 ];
            }

            if ( translate[ 2 ] !== 0.0 ) {
                val = translate[ 2 ];
                result[ 12 ] += val * mat[ 8 ];
                result[ 13 ] += val * mat[ 9 ];
                result[ 14 ] += val * mat[ 10 ];
                result[ 15 ] += val * mat[ 11 ];
            }
            return result;
        },

        makeRotate: function ( angle, x, y, z, result ) {
            if ( result === undefined ) {
                Notify.warn( 'no matrix destination !' );
                result = Matrix.create();
            }

            var mag = Math.sqrt( x * x + y * y + z * z );
            var sinAngle = Math.sin( angle );
            var cosAngle = Math.cos( angle );

            if ( mag > 0.0 ) {
                var xx, yy, zz, xy, yz, zx, xs, ys, zs;
                var oneMinusCos;

                mag = 1.0 / mag;

                x *= mag;
                y *= mag;
                z *= mag;

                xx = x * x;
                yy = y * y;
                zz = z * z;
                xy = x * y;
                yz = y * z;
                zx = z * x;
                xs = x * sinAngle;
                ys = y * sinAngle;
                zs = z * sinAngle;
                oneMinusCos = 1.0 - cosAngle;

                result[ 0 ] = ( oneMinusCos * xx ) + cosAngle;
                result[ 1 ] = ( oneMinusCos * xy ) - zs;
                result[ 2 ] = ( oneMinusCos * zx ) + ys;
                result[ 3 ] = 0.0;

                result[ 4 ] = ( oneMinusCos * xy ) + zs;
                result[ 5 ] = ( oneMinusCos * yy ) + cosAngle;
                result[ 6 ] = ( oneMinusCos * yz ) - xs;
                result[ 7 ] = 0.0;

                result[ 8 ] = ( oneMinusCos * zx ) - ys;
                result[ 9 ] = ( oneMinusCos * yz ) + xs;
                result[ 10 ] = ( oneMinusCos * zz ) + cosAngle;
                result[ 11 ] = 0.0;

                result[ 12 ] = 0.0;
                result[ 13 ] = 0.0;
                result[ 14 ] = 0.0;
                result[ 15 ] = 1.0;

                return result;
            } else {
                return Matrix.makeIdentity( result );
            }

            return result;
        },

        transform3x3: function ( m, v, result ) {
            if ( result === undefined ) {
                Notify.warn( 'no matrix destination !' );
                result = Matrix.create();
            }
            result[ 0 ] = m[ 0 ] * v[ 0 ] + m[ 1 ] * v[ 1 ] + m[ 2 ] * v[ 2 ];
            result[ 1 ] = m[ 4 ] * v[ 0 ] + m[ 5 ] * v[ 1 ] + m[ 6 ] * v[ 2 ];
            result[ 2 ] = m[ 8 ] * v[ 0 ] + m[ 9 ] * v[ 1 ] + m[ 10 ] * v[ 2 ];
            return result;
        },

        transformVec3: ( function () {
            var tmpVec = [ 0.0, 0.0, 0.0 ];

            return function ( matrix, vector, result ) {
                var d = 1.0 / ( matrix[ 3 ] * vector[ 0 ] + matrix[ 7 ] * vector[ 1 ] + matrix[ 11 ] * vector[ 2 ] + matrix[ 15 ] );

                if ( result === undefined ) {
                    Notify.warn( 'no matrix destination !' );
                    result = Matrix.create();
                }

                var tmp;
                if ( result === vector ) {
                    tmp = tmpVec;
                } else {
                    tmp = result;
                }
                tmp[ 0 ] = ( matrix[ 0 ] * vector[ 0 ] + matrix[ 4 ] * vector[ 1 ] + matrix[ 8 ] * vector[ 2 ] + matrix[ 12 ] ) * d;
                tmp[ 1 ] = ( matrix[ 1 ] * vector[ 0 ] + matrix[ 5 ] * vector[ 1 ] + matrix[ 9 ] * vector[ 2 ] + matrix[ 13 ] ) * d;
                tmp[ 2 ] = ( matrix[ 2 ] * vector[ 0 ] + matrix[ 6 ] * vector[ 1 ] + matrix[ 10 ] * vector[ 2 ] + matrix[ 14 ] ) * d;

                if ( result === vector ) {
                    Vec3.copy( tmp, result );
                }
                return result;
            };
        } )(),

        transformVec4: ( function () {
            var tmpVec = [ 0.0, 0.0, 0.0 ];

            return function ( matrix, vector, result ) {
                if ( result === undefined ) {
                    Notify.warn( 'no matrix destination !' );
                    result = Matrix.create();
                }
                var tmp;
                if ( result === vector ) {
                    tmp = tmpVec;
                } else {
                    tmp = result;
                }
                tmp[ 0 ] = ( matrix[ 0 ] * vector[ 0 ] + matrix[ 1 ] * vector[ 1 ] + matrix[ 2 ] * vector[ 2 ] + matrix[ 3 ] * vector[ 3 ] );
                tmp[ 1 ] = ( matrix[ 4 ] * vector[ 0 ] + matrix[ 5 ] * vector[ 1 ] + matrix[ 6 ] * vector[ 2 ] + matrix[ 7 ] * vector[ 3 ] );
                tmp[ 2 ] = ( matrix[ 8 ] * vector[ 0 ] + matrix[ 9 ] * vector[ 1 ] + matrix[ 10 ] * vector[ 2 ] + matrix[ 11 ] * vector[ 3 ] );
                tmp[ 3 ] = ( matrix[ 12 ] * vector[ 0 ] + matrix[ 13 ] * vector[ 1 ] + matrix[ 14 ] * vector[ 2 ] + matrix[ 15 ] * vector[ 3 ] );

                if ( result === vector ) {
                    Vec4.copy( tmp, result );
                }
                return result;
            };
        } )(),

        copy: function ( matrix, result ) {
            if ( result === undefined ) {
                Notify.warn( 'no matrix destination !' );
                result = Matrix.create();
            }
            result[ 0 ] = matrix[ 0 ];
            result[ 1 ] = matrix[ 1 ];
            result[ 2 ] = matrix[ 2 ];
            result[ 3 ] = matrix[ 3 ];
            result[ 4 ] = matrix[ 4 ];
            result[ 5 ] = matrix[ 5 ];
            result[ 6 ] = matrix[ 6 ];
            result[ 7 ] = matrix[ 7 ];
            result[ 8 ] = matrix[ 8 ];
            result[ 9 ] = matrix[ 9 ];
            result[ 10 ] = matrix[ 10 ];
            result[ 11 ] = matrix[ 11 ];
            result[ 12 ] = matrix[ 12 ];
            result[ 13 ] = matrix[ 13 ];
            result[ 14 ] = matrix[ 14 ];
            result[ 15 ] = matrix[ 15 ];
            return result;
        },

        inverse: ( function () {
            var tmp = [ 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0 ];

            return function ( matrix, result ) {
                if ( result === matrix ) {
                    Matrix.copy( matrix, tmp );
                    matrix = tmp;
                }

                if ( matrix[ 3 ] === 0.0 && matrix[ 7 ] === 0.0 && matrix[ 11 ] === 0.0 && matrix[ 15 ] === 1.0 ) {
                    return Matrix.inverse4x3( matrix, result );
                } else {
                    return Matrix.inverse4x4( matrix, result );
                }
            };
        } )(),

        /**
         *  if a result argument is given the return of the function is true or false
         *  depending if the matrix can be inverted, else if no result argument is given
         *  the return is identity if the matrix can not be inverted and the matrix overthise
         */
        inverse4x4: function ( matrix, result ) {
            var tmp0 = matrix[ 10 ] * matrix[ 15 ];
            var tmp1 = matrix[ 14 ] * matrix[ 11 ];
            var tmp2 = matrix[ 6 ] * matrix[ 15 ];
            var tmp3 = matrix[ 14 ] * matrix[ 7 ];
            var tmp4 = matrix[ 6 ] * matrix[ 11 ];
            var tmp5 = matrix[ 10 ] * matrix[ 7 ];
            var tmp6 = matrix[ 2 ] * matrix[ 15 ];
            var tmp7 = matrix[ 14 ] * matrix[ 3 ];
            var tmp8 = matrix[ 2 ] * matrix[ 11 ];
            var tmp9 = matrix[ 10 ] * matrix[ 3 ];
            var tmp10 = matrix[ 2 ] * matrix[ 7 ];
            var tmp11 = matrix[ 6 ] * matrix[ 3 ];
            var tmp12 = matrix[ 8 ] * matrix[ 13 ];
            var tmp13 = matrix[ 12 ] * matrix[ 9 ];
            var tmp14 = matrix[ 4 ] * matrix[ 13 ];
            var tmp15 = matrix[ 12 ] * matrix[ 5 ];
            var tmp16 = matrix[ 4 ] * matrix[ 9 ];
            var tmp17 = matrix[ 8 ] * matrix[ 5 ];
            var tmp18 = matrix[ 0 ] * matrix[ 13 ];
            var tmp19 = matrix[ 12 ] * matrix[ 1 ];
            var tmp20 = matrix[ 0 ] * matrix[ 9 ];
            var tmp21 = matrix[ 8 ] * matrix[ 1 ];
            var tmp22 = matrix[ 0 ] * matrix[ 5 ];
            var tmp23 = matrix[ 4 ] * matrix[ 1 ];

            var t0 = ( ( tmp0 * matrix[ 5 ] + tmp3 * matrix[ 9 ] + tmp4 * matrix[ 13 ] ) -
                ( tmp1 * matrix[ 5 ] + tmp2 * matrix[ 9 ] + tmp5 * matrix[ 13 ] ) );
            var t1 = ( ( tmp1 * matrix[ 1 ] + tmp6 * matrix[ 9 ] + tmp9 * matrix[ 13 ] ) -
                ( tmp0 * matrix[ 1 ] + tmp7 * matrix[ 9 ] + tmp8 * matrix[ 13 ] ) );
            var t2 = ( ( tmp2 * matrix[ 1 ] + tmp7 * matrix[ 5 ] + tmp10 * matrix[ 13 ] ) -
                ( tmp3 * matrix[ 1 ] + tmp6 * matrix[ 5 ] + tmp11 * matrix[ 13 ] ) );
            var t3 = ( ( tmp5 * matrix[ 1 ] + tmp8 * matrix[ 5 ] + tmp11 * matrix[ 9 ] ) -
                ( tmp4 * matrix[ 1 ] + tmp9 * matrix[ 5 ] + tmp10 * matrix[ 9 ] ) );

            var d1 = ( matrix[ 0 ] * t0 + matrix[ 4 ] * t1 + matrix[ 8 ] * t2 + matrix[ 12 ] * t3 );
            if ( Math.abs( d1 ) < 1e-5 ) {
                Notify.log( 'Warning can\'t inverse matrix ' + matrix );
                return false;
            }
            var d = 1.0 / d1;

            var out00 = d * t0;
            var out01 = d * t1;
            var out02 = d * t2;
            var out03 = d * t3;

            var out10 = d * ( ( tmp1 * matrix[ 4 ] + tmp2 * matrix[ 8 ] + tmp5 * matrix[ 12 ] ) -
                ( tmp0 * matrix[ 4 ] + tmp3 * matrix[ 8 ] + tmp4 * matrix[ 12 ] ) );
            var out11 = d * ( ( tmp0 * matrix[ 0 ] + tmp7 * matrix[ 8 ] + tmp8 * matrix[ 12 ] ) -
                ( tmp1 * matrix[ 0 ] + tmp6 * matrix[ 8 ] + tmp9 * matrix[ 12 ] ) );
            var out12 = d * ( ( tmp3 * matrix[ 0 ] + tmp6 * matrix[ 4 ] + tmp11 * matrix[ 12 ] ) -
                ( tmp2 * matrix[ 0 ] + tmp7 * matrix[ 4 ] + tmp10 * matrix[ 12 ] ) );
            var out13 = d * ( ( tmp4 * matrix[ 0 ] + tmp9 * matrix[ 4 ] + tmp10 * matrix[ 8 ] ) -
                ( tmp5 * matrix[ 0 ] + tmp8 * matrix[ 4 ] + tmp11 * matrix[ 8 ] ) );

            var out20 = d * ( ( tmp12 * matrix[ 7 ] + tmp15 * matrix[ 11 ] + tmp16 * matrix[ 15 ] ) -
                ( tmp13 * matrix[ 7 ] + tmp14 * matrix[ 11 ] + tmp17 * matrix[ 15 ] ) );
            var out21 = d * ( ( tmp13 * matrix[ 3 ] + tmp18 * matrix[ 11 ] + tmp21 * matrix[ 15 ] ) -
                ( tmp12 * matrix[ 3 ] + tmp19 * matrix[ 11 ] + tmp20 * matrix[ 15 ] ) );
            var out22 = d * ( ( tmp14 * matrix[ 3 ] + tmp19 * matrix[ 7 ] + tmp22 * matrix[ 15 ] ) -
                ( tmp15 * matrix[ 3 ] + tmp18 * matrix[ 7 ] + tmp23 * matrix[ 15 ] ) );
            var out23 = d * ( ( tmp17 * matrix[ 3 ] + tmp20 * matrix[ 7 ] + tmp23 * matrix[ 11 ] ) -
                ( tmp16 * matrix[ 3 ] + tmp21 * matrix[ 7 ] + tmp22 * matrix[ 11 ] ) );

            var out30 = d * ( ( tmp14 * matrix[ 10 ] + tmp17 * matrix[ 14 ] + tmp13 * matrix[ 6 ] ) -
                ( tmp16 * matrix[ 14 ] + tmp12 * matrix[ 6 ] + tmp15 * matrix[ 10 ] ) );
            var out31 = d * ( ( tmp20 * matrix[ 14 ] + tmp12 * matrix[ 2 ] + tmp19 * matrix[ 10 ] ) -
                ( tmp18 * matrix[ 10 ] + tmp21 * matrix[ 14 ] + tmp13 * matrix[ 2 ] ) );
            var out32 = d * ( ( tmp18 * matrix[ 6 ] + tmp23 * matrix[ 14 ] + tmp15 * matrix[ 2 ] ) -
                ( tmp22 * matrix[ 14 ] + tmp14 * matrix[ 2 ] + tmp19 * matrix[ 6 ] ) );
            var out33 = d * ( ( tmp22 * matrix[ 10 ] + tmp16 * matrix[ 2 ] + tmp21 * matrix[ 6 ] ) -
                ( tmp20 * matrix[ 6 ] + tmp23 * matrix[ 10 ] + tmp17 * matrix[ 2 ] ) );

            result[ 0 ] = out00;
            result[ 1 ] = out01;
            result[ 2 ] = out02;
            result[ 3 ] = out03;
            result[ 4 ] = out10;
            result[ 5 ] = out11;
            result[ 6 ] = out12;
            result[ 7 ] = out13;
            result[ 8 ] = out20;
            result[ 9 ] = out21;
            result[ 10 ] = out22;
            result[ 11 ] = out23;
            result[ 12 ] = out30;
            result[ 13 ] = out31;
            result[ 14 ] = out32;
            result[ 15 ] = out33;

            return true;
        },

        // comes from OpenSceneGraph
        /*
      Matrix inversion technique:
      Given a matrix mat, we want to invert it.
      mat = [ r00 r01 r02 a
              r10 r11 r12 b
              r20 r21 r22 c
              tx  ty  tz  d ]
      We note that this matrix can be split into three matrices.
      mat = rot * trans * corr, where rot is rotation part, trans is translation part, and corr is the correction due to perspective (if any).
      rot = [ r00 r01 r02 0
              r10 r11 r12 0
              r20 r21 r22 0
              0   0   0   1 ]
      trans = [ 1  0  0  0
                0  1  0  0
                0  0  1  0
                tx ty tz 1 ]
      corr = [ 1 0 0 px
               0 1 0 py
               0 0 1 pz
               0 0 0 s ]

      where the elements of corr are obtained from linear combinations of the elements of rot, trans, and mat.
      So the inverse is mat' = (trans * corr)' * rot', where rot' must be computed the traditional way, which is easy since it is only a 3x3 matrix.
      This problem is simplified if [px py pz s] = [0 0 0 1], which will happen if mat was composed only of rotations, scales, and translations (which is common).  In this case, we can ignore corr entirely which saves on a lot of computations.
    */

        inverse4x3: ( function () {
            var inv = [ 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0 ];

            return function ( matrix, result ) {

                // Copy rotation components
                var r00 = matrix[ 0 ];
                var r01 = matrix[ 1 ];
                var r02 = matrix[ 2 ];

                var r10 = matrix[ 4 ];
                var r11 = matrix[ 5 ];
                var r12 = matrix[ 6 ];

                var r20 = matrix[ 8 ];
                var r21 = matrix[ 9 ];
                var r22 = matrix[ 10 ];

                // Partially compute inverse of rot
                result[ 0 ] = r11 * r22 - r12 * r21;
                result[ 1 ] = r02 * r21 - r01 * r22;
                result[ 2 ] = r01 * r12 - r02 * r11;

                // Compute determinant of rot from 3 elements just computed
                var oneOverDet = 1.0 / ( r00 * result[ 0 ] + r10 * result[ 1 ] + r20 * result[ 2 ] );
                r00 *= oneOverDet;
                r10 *= oneOverDet;
                r20 *= oneOverDet; // Saves on later computations

                // Finish computing inverse of rot
                result[ 0 ] *= oneOverDet;
                result[ 1 ] *= oneOverDet;
                result[ 2 ] *= oneOverDet;
                result[ 3 ] = 0.0;
                result[ 4 ] = r12 * r20 - r10 * r22; // Have already been divided by det
                result[ 5 ] = r00 * r22 - r02 * r20; // same
                result[ 6 ] = r02 * r10 - r00 * r12; // same
                result[ 7 ] = 0.0;
                result[ 8 ] = r10 * r21 - r11 * r20; // Have already been divided by det
                result[ 9 ] = r01 * r20 - r00 * r21; // same
                result[ 10 ] = r00 * r11 - r01 * r10; // same
                result[ 11 ] = 0.0;
                result[ 15 ] = 1.0;

                var tx, ty, tz;

                var d = matrix[ 15 ];
                var dm = d - 1.0;
                if ( dm * dm > 1.0e-6 ) // Involves perspective, so we must
                { // compute the full inverse

                    result[ 12 ] = result[ 13 ] = result[ 14 ] = 0.0;

                    var a = matrix[ 3 ];
                    var b = matrix[ 7 ];
                    var c = matrix[ 11 ];
                    var px = result[ 0 ] * a + result[ 1 ] * b + result[ 2 ] * c;
                    var py = result[ 4 ] * a + result[ 5 ] * b + result[ 6 ] * c;
                    var pz = result[ 8 ] * a + result[ 9 ] * b + result[ 10 ] * c;

                    tx = matrix[ 12 ];
                    ty = matrix[ 13 ];
                    tz = matrix[ 14 ];
                    var oneOverS = 1.0 / ( d - ( tx * px + ty * py + tz * pz ) );

                    tx *= oneOverS;
                    ty *= oneOverS;
                    tz *= oneOverS; // Reduces number of calculations later on

                    // Compute inverse of trans*corr
                    inv[ 0 ] = tx * px + 1.0;
                    inv[ 1 ] = ty * px;
                    inv[ 2 ] = tz * px;
                    inv[ 3 ] = -px * oneOverS;
                    inv[ 4 ] = tx * py;
                    inv[ 5 ] = ty * py + 1.0;
                    inv[ 6 ] = tz * py;
                    inv[ 7 ] = -py * oneOverS;
                    inv[ 8 ] = tx * pz;
                    inv[ 9 ] = ty * pz;
                    inv[ 10 ] = tz * pz + 1.0;
                    inv[ 11 ] = -pz * oneOverS;
                    inv[ 12 ] = -tx;
                    inv[ 13 ] = -ty;
                    inv[ 14 ] = -tz;
                    inv[ 15 ] = oneOverS;

                    Matrix.preMult( result, inv ); // Finish computing full inverse of mat
                } else {

                    tx = matrix[ 12 ];
                    ty = matrix[ 13 ];
                    tz = matrix[ 14 ];

                    // Compute translation components of mat'
                    result[ 12 ] = -( tx * result[ 0 ] + ty * result[ 4 ] + tz * result[ 8 ] );
                    result[ 13 ] = -( tx * result[ 1 ] + ty * result[ 5 ] + tz * result[ 9 ] );
                    result[ 14 ] = -( tx * result[ 2 ] + ty * result[ 6 ] + tz * result[ 10 ] );
                }
                return true;
            };
        } )(),

        transpose: function ( mat, dest ) {
            // from glMatrix
            // If we are transposing ourselves we can skip a few steps but have to cache some values
            if ( mat === dest ) {
                var a01 = mat[ 1 ],
                    a02 = mat[ 2 ],
                    a03 = mat[ 3 ];
                var a12 = mat[ 6 ],
                    a13 = mat[ 7 ];
                var a23 = mat[ 11 ];

                mat[ 1 ] = mat[ 4 ];
                mat[ 2 ] = mat[ 8 ];
                mat[ 3 ] = mat[ 12 ];
                mat[ 4 ] = a01;
                mat[ 6 ] = mat[ 9 ];
                mat[ 7 ] = mat[ 13 ];
                mat[ 8 ] = a02;
                mat[ 9 ] = a12;
                mat[ 11 ] = mat[ 14 ];
                mat[ 12 ] = a03;
                mat[ 13 ] = a13;
                mat[ 14 ] = a23;
                return mat;
            } else {
                dest[ 0 ] = mat[ 0 ];
                dest[ 1 ] = mat[ 4 ];
                dest[ 2 ] = mat[ 8 ];
                dest[ 3 ] = mat[ 12 ];
                dest[ 4 ] = mat[ 1 ];
                dest[ 5 ] = mat[ 5 ];
                dest[ 6 ] = mat[ 9 ];
                dest[ 7 ] = mat[ 13 ];
                dest[ 8 ] = mat[ 2 ];
                dest[ 9 ] = mat[ 6 ];
                dest[ 10 ] = mat[ 10 ];
                dest[ 11 ] = mat[ 14 ];
                dest[ 12 ] = mat[ 3 ];
                dest[ 13 ] = mat[ 7 ];
                dest[ 14 ] = mat[ 11 ];
                dest[ 15 ] = mat[ 15 ];
                return dest;
            }
        },

        makePerspective: function ( fovy, aspect, znear, zfar, result ) {
            if ( result === undefined ) {
                Notify.warn( 'no matrix destination !' );
                result = Matrix.create();
            }
            var ymax = znear * Math.tan( fovy * Math.PI / 360.0 );
            var ymin = -ymax;
            var xmin = ymin * aspect;
            var xmax = ymax * aspect;

            return Matrix.makeFrustum( xmin, xmax, ymin, ymax, znear, zfar, result );
        },

        getFrustum: function ( matrix, result ) {
            var right = 0.0;
            var left = 0.0;
            var top = 0.0;
            var bottom = 0.0;
            var zNear, zFar;

            if ( matrix[ 0 * 4 + 3 ] !== 0.0 || matrix[ 1 * 4 + 3 ] !== 0.0 || matrix[ 2 * 4 + 3 ] !== -1.0 || matrix[ 3 * 4 + 3 ] !== 0.0 ) {
                return false;
            }

            // note: near and far must be used inside this method instead of zNear and zFar
            // because zNear and zFar are references and they may point to the same variable.
            var tempNear = matrix[ 3 * 4 + 2 ] / ( matrix[ 2 * 4 + 2 ] - 1.0 );
            var tempFar = matrix[ 3 * 4 + 2 ] / ( 1.0 + matrix[ 2 * 4 + 2 ] );

            left = tempNear * ( matrix[ 2 * 4 ] - 1.0 ) / matrix[ 0 ];
            right = tempNear * ( 1.0 + matrix[ 2 * 4 ] ) / matrix[ 0 ];

            top = tempNear * ( 1.0 + matrix[ 2 * 4 + 1 ] ) / matrix[ 1 * 4 + 1 ];
            bottom = tempNear * ( matrix[ 2 * 4 + 1 ] - 1.0 ) / matrix[ 1 * 4 + 1 ];

            zNear = tempNear;
            zFar = tempFar;

            result.left = left;
            result.right = right;
            result.top = top;
            result.bottom = bottom;
            result.zNear = zNear;
            result.zFar = zFar;

            return true;
        },

        getPerspective: ( function () {
            var c = {
                'right': 0,
                'left': 0,
                'top': 0,
                'bottom': 0,
                'zNear': 0,
                'zFar': 0
            };
            return function ( matrix, result ) {
                // get frustum and compute results
                var r = Matrix.getFrustum( matrix, c );
                if ( r ) {
                    result.fovy = 180 / Math.PI * ( Math.atan( c.top / c.zNear ) - Math.atan( c.bottom / c.zNear ) );
                    result.aspectRatio = ( c.right - c.left ) / ( c.top - c.bottom );
                }
                result.zNear = c.zNear;
                result.zFar = c.zFar;
                return result;
            };
        } )(),

        makeScale: function ( x, y, z, result ) {
            if ( result === undefined ) {
                Notify.warn( 'no matrix destination !' );
                result = Matrix.create();
            }
            Matrix.setRow( result, 0, x, 0.0, 0.0, 0.0 );
            Matrix.setRow( result, 1, 0.0, y, 0.0, 0.0 );
            Matrix.setRow( result, 2, 0.0, 0.0, z, 0.0 );
            Matrix.setRow( result, 3, 0.0, 0.0, 0.0, 1.0 );
            return result;
        },

        // compute the 4 corners vector of the frustrum
        computeFrustrumCornersVectors: function ( projectionMatrix, vectorsArray ) {
            //var znear = projectionMatrix[ 12 + 2 ] / ( projectionMatrix[ 8 + 2 ] - 1.0 );
            //var zfar = projectionMatrix[ 12 + 2 ] / ( projectionMatrix[ 8 + 2 ] + 1.0 );
            var x = 1.0 / projectionMatrix[ 0 ];
            var y = 1.0 / projectionMatrix[ 1 * 4 + 1 ];

            vectorsArray[ 0 ] = [ -x, y, 1.0 ];
            vectorsArray[ 1 ] = [ -x, -y, 1.0 ];
            vectorsArray[ 2 ] = [ x, -y, 1.0 ];
            vectorsArray[ 3 ] = [ x, y, 1.0 ];
            return vectorsArray;
        },

        makeFrustum: function ( left, right, bottom, top, znear, zfar, result ) {
            if ( result === undefined ) {
                Notify.warn( 'no matrix destination !' );
                result = Matrix.create();
            }
            var X = 2.0 * znear / ( right - left );
            var Y = 2.0 * znear / ( top - bottom );
            var A = ( right + left ) / ( right - left );
            var B = ( top + bottom ) / ( top - bottom );
            var C = -( zfar + znear ) / ( zfar - znear );
            var D = -2.0 * zfar * znear / ( zfar - znear );
            Matrix.setRow( result, 0, X, 0.0, 0.0, 0.0 );
            Matrix.setRow( result, 1, 0.0, Y, 0.0, 0.0 );
            Matrix.setRow( result, 2, A, B, C, -1.0 );
            Matrix.setRow( result, 3, 0.0, 0.0, D, 0.0 );
            return result;
        },

        makeRotateFromQuat: function ( quat, result ) {
            Matrix.makeIdentity( result );
            return Matrix.setRotateFromQuat( result, quat );
        },

        setRotateFromQuat: function ( matrix, quat ) {
            var length2 = Quat.length2( quat );
            if ( Math.abs( length2 ) <= Number.MIN_VALUE ) {
                matrix[ 0 ] = 0.0;
                matrix[ 1 ] = 0.0;
                matrix[ 2 ] = 0.0;

                matrix[ 4 ] = 0.0;
                matrix[ 5 ] = 0.0;
                matrix[ 6 ] = 0.0;

                matrix[ 8 ] = 0.0;
                matrix[ 9 ] = 0.0;
                matrix[ 10 ] = 0.0;
            } else {
                var rlength2;
                // normalize quat if required.
                // We can avoid the expensive sqrt in this case since all 'coefficients' below are products of two q components.
                // That is a square of a square root, so it is possible to avoid that
                if ( length2 !== 1.0 ) {
                    rlength2 = 2.0 / length2;
                } else {
                    rlength2 = 2.0;
                }

                // Source: Gamasutra, Rotating Objects Using Quaternions
                //
                //http://www.gamasutra.com/features/19980703/quaternions_01.htm

                var wx, wy, wz, xx, yy, yz, xy, xz, zz, x2, y2, z2;

                // calculate coefficients
                x2 = rlength2 * quat[ 0 ];
                y2 = rlength2 * quat[ 1 ];
                z2 = rlength2 * quat[ 2 ];

                xx = quat[ 0 ] * x2;
                xy = quat[ 0 ] * y2;
                xz = quat[ 0 ] * z2;

                yy = quat[ 1 ] * y2;
                yz = quat[ 1 ] * z2;
                zz = quat[ 2 ] * z2;

                wx = quat[ 3 ] * x2;
                wy = quat[ 3 ] * y2;
                wz = quat[ 3 ] * z2;

                // Note.  Gamasutra gets the matrix assignments inverted, resulting
                // in left-handed rotations, which is contrary to OpenGL and OSG's
                // methodology.  The matrix assignment has been altered in the next
                // few lines of code to do the right thing.
                // Don Burns - Oct 13, 2001
                matrix[ 0 ] = 1.0 - ( yy + zz );
                matrix[ 4 ] = xy - wz;
                matrix[ 8 ] = xz + wy;


                matrix[ 0 + 1 ] = xy + wz;
                matrix[ 4 + 1 ] = 1.0 - ( xx + zz );
                matrix[ 8 + 1 ] = yz - wx;

                matrix[ 0 + 2 ] = xz - wy;
                matrix[ 4 + 2 ] = yz + wx;
                matrix[ 8 + 2 ] = 1.0 - ( xx + yy );
            }
            return matrix;
        }
    };

    return Matrix;
} );

define( 'osg/TransformEnums',[], function () {

    return {
        RELATIVE_RF: 0,
        ABSOLUTE_RF: 1
    };
} );

define( 'osg/ComputeMatrixFromNodePath',[
    'osg/Matrix',
    'osg/TransformEnums'
], function ( Matrix, TransformEnums ) {

    var computeLocalToWorld = function ( nodePath, ignoreCameras ) {
        var ignoreCamera = ignoreCameras;
        if ( ignoreCamera === undefined ) {
            ignoreCamera = true;
        }
        var matrix = Matrix.create();

        var j = 0;
        if ( ignoreCamera ) {
            for ( j = nodePath.length - 1; j > 0; j-- ) {
                var camera = nodePath[ j ];
                if ( camera.className() === 'Camera' &&
                    ( camera.getReferenceFrame !== TransformEnums.RELATIVE_RF || camera.getParents().length === 0 ) ) {
                    break;
                }
            }
        }

        for ( var i = j, l = nodePath.length; i < l; i++ ) {
            var node = nodePath[ i ];
            if ( node.computeLocalToWorldMatrix ) {
                node.computeLocalToWorldMatrix( matrix );
            }
        }
        return matrix;
    };

    return {
        computeLocalToWorld: computeLocalToWorld
    };
} );

define( 'osg/Node',[
    'osg/Utils',
    'osg/Object',
    'osg/BoundingBox',
    'osg/BoundingSphere',
    'osg/StateSet',
    'osg/NodeVisitor',
    'osg/Matrix',
    'osg/ComputeMatrixFromNodePath',
    'osg/TransformEnums'
], function ( MACROUTILS, Object, BoundingBox, BoundingSphere, StateSet, NodeVisitor, Matrix, ComputeMatrixFromNodePath, TransformEnums ) {

        /**
     *  Node that can contains child node
     *  @class Node
     */
    var Node = function () {
        Object.call( this );

        this.children = [];
        this.parents = [];
        /*jshint bitwise: false */
        this.nodeMask = ~0;
        /*jshint bitwise: true */

        this.boundingSphere = new BoundingSphere();
        this.boundingSphereComputed = false;
        this._updateCallbacks = [];
        this._cullCallback = undefined;
    };

    /** @lends Node.prototype */
    Node.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( Object.prototype, {
        /**
        Return StateSet and create it if it does not exist yet
        @type StateSet
     */
        getOrCreateStateSet: function () {
            if ( this.stateset === undefined ) {
                this.stateset = new StateSet();
            }
            return this.stateset;
        },
        getStateSet: function () {
            return this.stateset;
        },
        accept: function ( nv ) {
            if ( nv.validNodeMask( this ) ) {
                nv.pushOntoNodePath( this );
                nv.apply( this );
                nv.popFromNodePath();
            }
        },
        dirtyBound: function () {
            if ( this.boundingSphereComputed === true ) {
                this.boundingSphereComputed = false;
                for ( var i = 0, l = this.parents.length; i < l; i++ ) {
                    this.parents[ i ].dirtyBound();
                }
            }
        },
        setNodeMask: function ( mask ) {
            this.nodeMask = mask;
        },
        getNodeMask: function ( ) {
            return this.nodeMask;
        },
        setStateSet: function ( s ) {
            this.stateset = s;
        },

        /**
       <p>
        Set update node callback, called during update traversal.
        The Object must have the following method
        update(node, nodeVisitor) {}
        note, callback is responsible for scenegraph traversal so
        they must call traverse(node,nv) to ensure that the
        scene graph subtree (and associated callbacks) are traversed.
        </p>
        <p>
        Here a dummy UpdateCallback example
        </p>
        @example
        var DummyUpdateCallback = function() {};
        DummyUpdateCallback.prototype = {
            update: function(node, nodeVisitor) {
                return true;
            }
        };

        @param Oject callback
     */
        setUpdateCallback: function ( cb ) {
            this._updateCallbacks[ 0 ] = cb;
        },
        /** Get update node callback, called during update traversal.
        @type Oject
     */
        getUpdateCallback: function () {
            return this._updateCallbacks[ 0 ];
        },

        addUpdateCallback: function ( cb ) {
            this._updateCallbacks.push( cb );
        },
        removeUpdateCallback: function ( cb ) {
            var arrayIdx = this._updateCallbacks.indexOf( cb );
            if ( arrayIdx !== -1 )
                this._updateCallbacks.splice( arrayIdx, 1 );
        },
        getUpdateCallbackList: function () {
            return this._updateCallbacks;
        },


        /**
       <p>
        Set cull node callback, called during cull traversal.
        The Object must have the following method
        cull(node, nodeVisitor) {}
        note, callback is responsible for scenegraph traversal so
        they must return true to traverse.
        </p>
        <p>
        Here a dummy CullCallback example
        </p>
        @example
        var DummyCullCallback = function() {};
        DummyCullCallback.prototype = {
            cull: function(node, nodeVisitor) {
                return true;
            }
        };

        @param Oject callback
     */
        setCullCallback: function ( cb ) {
            this._cullCallback = cb;
        },
        getCullCallback: function () {
            return this._cullCallback;
        },

        hasChild: function ( child ) {
            for ( var i = 0, l = this.children.length; i < l; i++ ) {
                if ( this.children[ i ] === child ) {
                    return true;
                }
            }
            return false;
        },
        addChild: function ( child ) {
            var c = this.children.push( child );
            child.addParent( this );
            this.dirtyBound();
            return c;
        },
        getChildren: function () {
            return this.children;
        },
        getParents: function () {
            return this.parents;
        },
        addParent: function ( parent ) {
            this.parents.push( parent );
        },
        removeParent: function ( parent ) {
            for ( var i = 0, l = this.parents.length, parents = this.parents; i < l; i++ ) {
                if ( parents[ i ] === parent ) {
                    parents.splice( i, 1 );
                    return;
                }
            }
        },
        removeChildren: function () {
            var children = this.children;
            if ( children.length !== 0 ) {
                for ( var i = 0, l = children.length; i < l; i++ ) {
                    children[ i ].removeParent( this );
                }
                children.length = 0;
                this.dirtyBound();
            }
        },

        // preserve order
        removeChild: function ( child ) {
            var children = this.children;
            for ( var i = 0, l = children.length; i < l; i++ ) {
                if ( children[ i ] === child ) {
                    child.removeParent( this );
                    children.splice( i, 1 );
                    i--;
                    l--;
                    this.dirtyBound();
                }
            }
        },

        traverse: function ( visitor ) {
            for ( var i = 0, l = this.children.length; i < l; i++ ) {
                var child = this.children[ i ];
                child.accept( visitor );
            }
        },

        ascend: function ( visitor ) {
            for ( var i = 0, l = this.parents.length; i < l; i++ ) {
                var parent = this.parents[ i ];
                parent.accept( visitor );
            }
        },

        getBound: function () {
            if ( !this.boundingSphereComputed ) {
                this.computeBound( this.boundingSphere );
                this.boundingSphereComputed = true;
            }
            return this.boundingSphere;
        },

        computeBound: function ( bsphere ) {
            var bb = new BoundingBox();
            bb.init();
            bsphere.init();
            for ( var i = 0, l = this.children.length; i < l; i++ ) {
                var child = this.children[ i ];
                if ( child.referenceFrame === undefined || child.referenceFrame === TransformEnums.RELATIVE_RF ) {
                    bb.expandBySphere( child.getBound() );
                }
            }
            if ( !bb.valid() ) {
                return bsphere;
            }
            bsphere._center = bb.center();
            bsphere._radius = 0.0;
            for ( var j = 0, l2 = this.children.length; j < l2; j++ ) {
                var cc = this.children[ j ];
                if ( cc.referenceFrame === undefined || cc.referenceFrame === TransformEnums.RELATIVE_RF ) {
                    bsphere.expandRadiusBySphere( cc.getBound() );
                }
            }

            return bsphere;
        },

        getWorldMatrices: function ( halt ) {
            var CollectParentPaths = function ( halt ) {
                this.nodePaths = [];
                this.halt = halt;
                NodeVisitor.call( this, NodeVisitor.TRAVERSE_PARENTS );
            };
            CollectParentPaths.prototype = MACROUTILS.objectInehrit( NodeVisitor.prototype, {
                apply: function ( node ) {
                    if ( node.parents.length === 0 || node === this.halt ) {
                        // copy
                        this.nodePaths.push( this.nodePath.slice( 0 ) );
                    } else {
                        this.traverse( node );
                    }
                }
            } );
            var collected = new CollectParentPaths( halt );
            this.accept( collected );
            var matrixList = [];

            for ( var i = 0, l = collected.nodePaths.length; i < l; i++ ) {
                var np = collected.nodePaths[ i ];
                if ( np.length === 0 ) {
                    matrixList.push( Matrix.create() );
                } else {
                    matrixList.push( ComputeMatrixFromNodePath.computeLocalToWorld( np ) );
                }
            }
            return matrixList;
        }


    } ), 'osg', 'Node' );
    MACROUTILS.setTypeID( Node );

    return Node;
} );

define( 'osg/Transform',[
    'osg/Utils',
    'osg/Node',
    'osg/Matrix',
    'osg/Vec3',
    'osg/TransformEnums'
], function ( MACROUTILS, Node, Matrix, Vec3, TransformEnums ) {
        /**
     * Transform - base class for Transform type node ( Camera, MatrixTransform )
     * @class Transform
     * @inherits Node
     */
    var Transform = function () {
        Node.call( this );
        this.referenceFrame = TransformEnums.RELATIVE_RF;
    };

    /** @lends Transform.prototype */
    Transform.prototype = MACROUTILS.objectInehrit( Node.prototype, {
        setReferenceFrame: function ( value ) {
            this.referenceFrame = value;
        },
        getReferenceFrame: function () {
            return this.referenceFrame;
        },

        computeBound: (function ( ) {
            var xdash = [ 0.0, 0.0, 0.0 ];
            var ydash = [ 0.0, 0.0, 0.0 ];
            var zdash = [ 0.0, 0.0, 0.0 ];
            return function ( bsphere ) {
                Node.prototype.computeBound.call( this, bsphere );
                if ( !bsphere.valid() ) {
                    return bsphere;
                }
                var sphCenter = bsphere._center;
                var sphRadius = bsphere._radius;

                var matrix = Matrix.create();
                this.computeLocalToWorldMatrix( matrix );

                Vec3.copy( sphCenter, xdash );
                xdash[ 0 ] += sphRadius;
                Matrix.transformVec3( matrix, xdash, xdash );

                Vec3.copy( sphCenter, ydash );
                ydash[ 1 ] += sphRadius;
                Matrix.transformVec3( matrix, ydash, ydash );

                Vec3.copy( sphCenter, zdash );
                zdash[ 2 ] += sphRadius;
                Matrix.transformVec3( matrix, zdash, zdash );

                Matrix.transformVec3( matrix, sphCenter, sphCenter );

                var lenXdash = Vec3.distance( xdash, sphCenter );
                var lenYdash = Vec3.distance( ydash, sphCenter );
                var lenZdash = Vec3.distance( zdash, sphCenter );

                // bsphere._radius = Math.max( lenXdash, lenYdash, lenZdash );
                sphRadius = lenXdash < lenYdash ? lenXdash : lenYdash;
                bsphere._radius = sphCenter < lenZdash ? sphCenter : lenZdash;
                return bsphere;
            };
        })()
    } );

    return Transform;
} );

define( 'osg/CullSettings',[], function () {

    var CullSettings = function () {
        this._computeNearFar = true;
        this._nearFarRatio = 0.005;

        var lookVector = [ 0.0, 0.0, -1.0 ];
        /*jshint bitwise: false */
        this.bbCornerFar = ( lookVector[ 0 ] >= 0 ? 1 : 0 ) | ( lookVector[ 1 ] >= 0 ? 2 : 0 ) | ( lookVector[ 2 ] >= 0 ? 4 : 0 );
        this.bbCornerNear = ( ~this.bbCornerFar ) & 7;
        /*jshint bitwise: true */
    };

    CullSettings.prototype = {
        setCullSettings: function ( settings ) {
            this._computeNearFar = settings._computeNearFar;
            this._nearFarRatio = settings._nearFarRatio;
        },
        setNearFarRatio: function ( ratio ) {
            this._nearFarRatio = ratio;
        },
        getNearFarRatio: function () {
            return this._nearFarRatio;
        },
        setComputeNearFar: function ( value ) {
            this._computeNearFar = value;
        },
        getComputeNearFar: function () {
            return this._computeNearFar;
        }
    };

    return CullSettings;
} );

define( 'osg/Camera',[
    'osg/Utils',
    'osg/Transform',
    'osg/CullSettings',
    'osg/Matrix',
    'osg/TransformEnums'
], function ( MACROUTILS, Transform, CullSettings, Matrix, TransformEnums ) {

    /**
     * Camera - is a subclass of Transform which represents encapsulates the settings of a Camera.
     * @class Camera
     * @inherits Transform CullSettings
     */
    var Camera = function () {
        Transform.call( this );
        CullSettings.call( this );

        this.viewport = undefined;
        this.setClearColor( [ 0, 0, 0, 1.0 ] );
        this.setClearDepth( 1.0 );

        /*jshint bitwise: false */
        this.setClearMask( Camera.COLOR_BUFFER_BIT | Camera.DEPTH_BUFFER_BIT );
        /*jshint bitwise: true */

        this.setViewMatrix( Matrix.create() );
        this.setProjectionMatrix( Matrix.create() );
        this.renderOrder = Camera.NESTED_RENDER;
        this.renderOrderNum = 0;
    };

    Camera.PRE_RENDER = 0;
    Camera.NESTED_RENDER = 1;
    Camera.POST_RENDER = 2;

    Camera.COLOR_BUFFER_BIT = 0x00004000;
    Camera.DEPTH_BUFFER_BIT = 0x00000100;
    Camera.STENCIL_BUFFER_BIT = 0x00000400;

    /** @lends Camera.prototype */
    Camera.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit(
        CullSettings.prototype,
        MACROUTILS.objectInehrit( Transform.prototype, {

            setClearDepth: function ( depth ) {
                this.clearDepth = depth;
            },
            getClearDepth: function () {
                return this.clearDepth;
            },

            setClearMask: function ( mask ) {
                this.clearMask = mask;
            },
            getClearMask: function () {
                return this.clearMask;
            },

            setClearColor: function ( color ) {
                this.clearColor = color;
            },
            getClearColor: function () {
                return this.clearColor;
            },

            setViewport: function ( vp ) {
                this.viewport = vp;
                this.getOrCreateStateSet().setAttributeAndMode( vp );
            },
            getViewport: function () {
                return this.viewport;
            },


            setViewMatrix: function ( matrix ) {
                this.modelviewMatrix = matrix;
            },

            setProjectionMatrix: function ( matrix ) {
                this.projectionMatrix = matrix;
            },

            /** Set to an orthographic projection. See OpenGL glOrtho for documentation further details.*/
            setProjectionMatrixAsOrtho: function ( left, right,
                bottom, top,
                zNear, zFar ) {
                Matrix.makeOrtho( left, right, bottom, top, zNear, zFar, this.getProjectionMatrix() );
            },

            getViewMatrix: function () {
                return this.modelviewMatrix;
            },
            getProjectionMatrix: function () {
                return this.projectionMatrix;
            },
            getRenderOrder: function () {
                return this.renderOrder;
            },
            setRenderOrder: function ( order, orderNum ) {
                this.renderOrder = order;
                this.renderOrderNum = orderNum;
            },

            attachTexture: function ( bufferComponent, texture, level ) {
                if ( this.frameBufferObject ) {
                    this.frameBufferObject.dirty();
                }
                if ( level === undefined ) {
                    level = 0;
                }
                if ( this.attachments === undefined ) {
                    this.attachments = {};
                }
                this.attachments[ bufferComponent ] = {
                    'texture': texture,
                    'level': level
                };
            },

            attachRenderBuffer: function ( bufferComponent, internalFormat ) {
                if ( this.frameBufferObject ) {
                    this.frameBufferObject.dirty();
                }
                if ( this.attachments === undefined ) {
                    this.attachments = {};
                }
                this.attachments[ bufferComponent ] = {
                    'format': internalFormat
                };
            },

            computeLocalToWorldMatrix: function ( matrix /*,nodeVisitor*/ ) {
                if ( this.referenceFrame === TransformEnums.RELATIVE_RF ) {
                    Matrix.preMult( matrix, this.modelviewMatrix );
                } else { // absolute
                    matrix = this.modelviewMatrix;
                }
                return true;
            },

            computeWorldToLocalMatrix: ( function ( matrix /*, nodeVisitor */ ) {
                var inverse = Matrix.create();
                return function () {
                    if ( this.referenceFrame === TransformEnums.RELATIVE_RF ) {
                        Matrix.postMult( Matrix.inverse( this.modelviewMatrix, inverse ), matrix );
                    } else {
                        Matrix.inverse( this.modelviewMatrix, matrix );
                    }
                    return true;
                };
            } )()

        } ) ), 'osg', 'Camera' );

    MACROUTILS.setTypeID( Camera );

    return Camera;
} );

define( 'osg/CullFace',[
    'osg/Utils',
    'osg/StateAttribute'
], function ( MACROUTILS, StateAttribute ) {

    /**
     *  Manage CullFace attribute
     *  @class CullFace
     */
    var CullFace = function ( mode ) {
        StateAttribute.call( this );
        if ( mode === undefined ) {
            mode = CullFace.BACK;
        }
        this.setMode( mode );
    };

    CullFace.DISABLE = 0x0;
    CullFace.FRONT = 0x0404;
    CullFace.BACK = 0x0405;
    CullFace.FRONT_AND_BACK = 0x0408;

    /** @lends CullFace.prototype */
    CullFace.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( StateAttribute.prototype, {
        attributeType: 'CullFace',
        cloneType: function () {
            return new CullFace();
        },
        getType: function () {
            return this.attributeType;
        },
        getTypeMember: function () {
            return this.attributeType;
        },
        setMode: function ( mode ) {
            if ( typeof mode === 'string' ) {
                mode = CullFace[ mode ];
            }
            this._mode = mode;
        },
        getMode: function () {
            return this._mode;
        },
        apply: function ( state ) {
            var gl = state.getGraphicContext();
            if ( this._mode === CullFace.DISABLE ) {
                gl.disable( gl.CULL_FACE );
            } else {
                gl.enable( gl.CULL_FACE );
                gl.cullFace( this._mode );
            }
            this._dirty = false;
        }
    } ), 'osg', 'CullFace' );

    return CullFace;
} );

define( 'osg/CullStack',[], function () {

    var CullStack = function () {
        this._modelviewMatrixStack = [];
        this._projectionMatrixStack = [];
        this._viewportStack = [];
        this._bbCornerFar = 0;
        this._bbCornerNear = 0;
    };

    CullStack.prototype = {
        getProjectionMatrixStack: function () {
            return this._projectionMatrixStack;
        },
        getModelviewMatrixStack: function () {
            return this._modelviewMatrixStack;
        },
        getCurrentProjectionMatrix: function () {
            return this._projectionMatrixStack[ this._projectionMatrixStack.length - 1 ];
        },
        getCurrentModelviewMatrix: function () {
            return this._modelviewMatrixStack[ this._modelviewMatrixStack.length - 1 ];
        },
        getViewport: function () {
            if ( this._viewportStack.length === 0 ) {
                return undefined;
            }
            return this._viewportStack[ this._viewportStack.length - 1 ];
        },
        getLookVectorLocal: function () {
            var m = this._modelviewMatrixStack[ this._modelviewMatrixStack.length - 1 ];
            return [ -m[ 2 ], -m[ 6 ], -m[ 10 ] ];
        },
        pushViewport: function ( vp ) {
            this._viewportStack.push( vp );
        },
        popViewport: function () {
            this._viewportStack.pop();
        },
        pushModelviewMatrix: function ( matrix ) {
            this._modelviewMatrixStack.push( matrix );

            var lookVector = this.getLookVectorLocal();

            /*jshint bitwise: false */
            this._bbCornerFar = ( lookVector[ 0 ] >= 0 ? 1 : 0 ) | ( lookVector[ 1 ] >= 0 ? 2 : 0 ) | ( lookVector[ 2 ] >= 0 ? 4 : 0 );
            this._bbCornerNear = ( ~this._bbCornerFar ) & 7;
            /*jshint bitwise: true */

        },
        popModelviewMatrix: function () {

            this._modelviewMatrixStack.pop();
            var lookVector;
            if ( this._modelviewMatrixStack.length !== 0 ) {
                lookVector = this.getLookVectorLocal();
            } else {
                lookVector = [ 0, 0, -1 ];
            }

            /*jshint bitwise: false */
            this._bbCornerFar = ( lookVector[ 0 ] >= 0 ? 1 : 0 ) | ( lookVector[ 1 ] >= 0 ? 2 : 0 ) | ( lookVector[ 2 ] >= 0 ? 4 : 0 );
            this._bbCornerNear = ( ~this._bbCornerFar ) & 7;
            /*jshint bitwise: true */


        },
        pushProjectionMatrix: function ( matrix ) {
            this._projectionMatrixStack.push( matrix );
        },
        popProjectionMatrix: function () {
            this._projectionMatrixStack.pop();
        }
    };

    return CullStack;
} );

define( 'osg/MatrixTransform',[
    'osg/Utils',
    'osg/Matrix',
    'osg/Transform',
    'osg/TransformEnums'
], function ( MACROUTILS, Matrix, Transform, TransformEnums ) {

    /**
     *  MatrixTransform is a Transform Node that can be customized with user matrix
     *  @class MatrixTransform
     */
    var MatrixTransform = function () {
        Transform.call( this );
        this.matrix = Matrix.create();
    };

    /** @lends MatrixTransform.prototype */
    MatrixTransform.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( Transform.prototype, {
        getMatrix: function () {
            return this.matrix;
        },
        setMatrix: function ( m ) {
            this.matrix = m;
        },
        computeLocalToWorldMatrix: function ( matrix /*, nodeVisitor */) {
            if ( this.referenceFrame === TransformEnums.RELATIVE_RF ) {
                Matrix.preMult( matrix, this.matrix );
            } else {
                matrix = this.matrix;
            }
            return true;
        },
        computeWorldToLocalMatrix: function ( matrix /*, nodeVisitor */ ) {
            var minverse = Matrix.create();
            Matrix.inverse( this.matrix, minverse );

            if ( this.referenceFrame === TransformEnums.RELATIVE_RF ) {
                Matrix.postMult( minverse, matrix );
            } else { // absolute
                matrix = minverse;
            }
            return true;
        }
    } ), 'osg', 'MatrixTransform' );
    MACROUTILS.setTypeID( MatrixTransform );

    return MatrixTransform;
} );

define( 'osg/Projection',[
    'osg/Utils',
    'osg/Node',
    'osg/Matrix'
], function ( MACROUTILS, Node, Matrix ) {

    var Projection = function () {
        Node.call( this );
        this.projection = Matrix.create();
    };
    Projection.prototype = MACROUTILS.objectInehrit( Node.prototype, {
        getProjectionMatrix: function () {
            return this.projection;
        },
        setProjectionMatrix: function ( m ) {
            this.projection = m;
        }
    } );

    MACROUTILS.setTypeID( Projection );

    return Projection;
} );

define( 'osg/LightSource',[
    'osg/Utils',
    'osg/Node'
], function ( MACROUTILS, Node ) {

    /**
     *  LightSource is a positioned node to use with StateAttribute Light
     *  @class LightSource
     */
    var LightSource = function () {
        Node.call( this );
        this._light = undefined;
    };

    /** @lends LightSource.prototype */
    LightSource.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( Node.prototype, {
        getLight: function () {
            return this._light;
        },
        setLight: function ( light ) {
            this._light = light;
        }
    } ), 'osg', 'LightSource' );

    MACROUTILS.setTypeID( LightSource );

    return LightSource;
} );

define( 'osg/Geometry',[
    'osg/Utils',
    'osg/Vec3',
    'osg/Node',
    'osg/BoundingBox'
], function ( MACROUTILS, Vec3, Node, BoundingBox ) {

    /**
     * Geometry manage array and primitives to draw a geometry.
     * @class Geometry
     */
    var Geometry = function () {
        Node.call( this );
        this.primitives = [];
        this.attributes = {};
        this.boundingBox = new BoundingBox();
        this.boundingBoxComputed = false;
        this.cacheAttributeList = {};
        this._shape = null;
    };

    /** @lends Geometry.prototype */
    Geometry.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( Node.prototype, {
        releaseGLObjects: function ( gl ) {
            var i;
            for ( i in this.attributes ) {
                this.attributes[ i ].releaseGLObjects( gl );
            }
            for ( var j = 0, l = this.primitives.length; j < l; j++ ) {
                var prim = this.primitives[ j ];
                if ( prim.getIndices !== undefined ) {
                    if ( prim.getIndices() !== undefined && prim.getIndices() !== null ) {
                        prim.indices.releaseGLObjects( gl );
                    }
                }
            }
        },
        dirtyBound: function () {
            if ( this.boundingBoxComputed === true ) {
                this.boundingBoxComputed = false;
            }
            Node.prototype.dirtyBound.call( this );
        },

        dirty: function () {
            this.cacheAttributeList = {};
        },
        getPrimitives: function () {
            return this.primitives;
        },
        getAttributes: function () {
            return this.attributes;
        },
        getShape: function () {
            return this._shape;
        },
        setShape: function ( shape ) {
            this._shape = shape;
        },
        getVertexAttributeList: function () {
            return this.attributes;
        },
        getPrimitiveSetList: function () {
            return this.primitives;
        },

        drawImplementation: function ( state ) {
            var program = state.getLastProgramApplied();
            var prgID = program.getInstanceID();
            if ( this.cacheAttributeList[ prgID ] === undefined ) {
                var attribute;

                var attributesCacheKeys = program.attributesCache.getKeys();
                var attributesCacheContent = program.attributesCache.getMapContent();
                var attributeList = [];

                var generated = '//generated by Geometry::implementation\n';
                generated += 'state.lazyDisablingOfVertexAttributes();\n';
                generated += 'var attr;\n';

                for ( var i = 0, l = attributesCacheKeys.length; i < l; i++ ) {
                    var key = attributesCacheKeys[ i ];
                    attribute = attributesCacheContent[ key ];
                    var attr = this.attributes[ key ];
                    if ( attr === undefined ) {
                        continue;
                    }
                    attributeList.push( attribute );
                    // dont display the geometry if missing data
                    generated += 'attr = this.attributes[\'' + key + '\'];\n';
                    generated += 'if (!attr.isValid()) { return; }\n';
                    generated += 'state.setVertexAttribArray(' + attribute + ', attr, false);\n';
                }
                generated += 'state.applyDisablingOfVertexAttributes();\n';
                var primitives = this.primitives;
                generated += 'var primitives = this.primitives;\n';
                for ( var j = 0, m = primitives.length; j < m; ++j ) {
                    generated += 'primitives[' + j + '].draw(state);\n';
                }

                /*jshint evil: true */
                this.cacheAttributeList[ prgID ] = new Function( 'state', generated );
                /*jshint evil: false */
            }
            this.cacheAttributeList[ prgID ].call( this, state );
        },

        // for testing disabling drawing
        drawImplementationDummy: function ( state ) {
            /*jshint unused: true */
            // for testing only that's why the code is not removed
            var program = state.getLastProgramApplied();
            var attribute;
            var attributeList = [];
            var attributesCache = program.attributesCache;


            var primitives = this.primitives;
            //state.disableVertexAttribsExcept(attributeList);

            for ( var j = 0, m = primitives.length; j < m; ++j ) {
                //primitives[j].draw(state);
            }
            /*jshint unused: false */
        },

        getBoundingBox: function () {
            if ( !this.boundingBoxComputed ) {
                this.computeBoundingBox( this.boundingBox );
                this.boundingBoxComputed = true;
            }
            return this.boundingBox;
        },

        computeBoundingBox: function ( boundingBox ) {

            var vertexArray = this.getAttributes().Vertex;
            var v = [ 0.0, 0.0, 0.0 ];
            if ( vertexArray !== undefined &&
                vertexArray.getElements() !== undefined &&
                vertexArray.getItemSize() > 2 ) {
                var vertexes = vertexArray.getElements();
                Vec3.init( v );
                for ( var idx = 0, l = vertexes.length; idx < l; idx += 3 ) {
                    v[ 0 ] = vertexes[ idx ];
                    v[ 1 ] = vertexes[ idx + 1 ];
                    v[ 2 ] = vertexes[ idx + 2 ];
                    boundingBox.expandByVec3( v );
                }
            }
            return boundingBox;
        },

        computeBound: function ( boundingSphere ) {
            boundingSphere.init();
            var bb = this.getBoundingBox();
            boundingSphere.expandByBox( bb );
            return boundingSphere;
        }
    } ), 'osg', 'Geometry' );

    MACROUTILS.setTypeID( Geometry );

    return Geometry;
} );

define( 'osg/RenderBin',[
    'osg/Notify',
    'osg/StateGraph',
    'osg/Matrix'
], function ( Notify, StateGraph, Matrix ) {

    var RenderBin = function () {
        this._leafs = [];
        this.positionedAttribute = [];
        this._renderStage = undefined;
        this._bins = {};
        this.stateGraphList = [];
        this._parent = undefined;
        this._binNum = 0;

        this._sorted = false;
        this._sortMode = RenderBin.SORT_BY_STATE;

    };
    RenderBin.SORT_BY_STATE = 0;
    RenderBin.SORT_BACK_TO_FRONT = 1;
    RenderBin.BinPrototypes = {
        RenderBin: function () {
            return new RenderBin();
        },
        DepthSortedBin: function () {
            var rb = new RenderBin();
            rb._sortMode = RenderBin.SORT_BACK_TO_FRONT;
            return rb;
        }
    };

    RenderBin.prototype = {
        _createRenderBin: function ( binName ) {
            if ( binName === undefined || RenderBin.BinPrototypes[ binName ] === undefined ) {
                return RenderBin.BinPrototypes.RenderBin();
            }
            return RenderBin.BinPrototypes[ binName ]();
        },
        getStateGraphList: function () {
            return this.stateGraphList;
        },
        copyLeavesFromStateGraphListToRenderLeafList: function () {

            this._leafs.splice( 0, this._leafs.length );
            var detectedNaN = false;

            for ( var i = 0, l = this.stateGraphList.length; i < l; i++ ) {
                var leafs = this.stateGraphList[ i ].leafs;
                for ( var j = 0, k = leafs.length; j < k; j++ ) {
                    var leaf = leafs[ j ];
                    if ( isNaN( leaf.depth ) ) {
                        detectedNaN = true;
                    } else {
                        this._leafs.push( leaf );
                    }
                }
            }

            if ( detectedNaN ) {
                Notify.debug( 'warning: RenderBin::copyLeavesFromStateGraphListToRenderLeafList() detected NaN depth values, database may be corrupted.' );
            }
            // empty the render graph list to prevent it being drawn along side the render leaf list (see drawImplementation.)
            this.stateGraphList.splice( 0, this.stateGraphList.length );
        },

        sortBackToFront: function () {
            this.copyLeavesFromStateGraphListToRenderLeafList();
            var cmp = function ( a, b ) {
                return b.depth - a.depth;
            };
            this._leafs.sort( cmp );
        },

        sortImplementation: function () {
            var SortMode = RenderBin;
            switch ( this._sortMode ) {
            case SortMode.SORT_BACK_TO_FRONT:
                this.sortBackToFront();
                break;
            case SortMode.SORT_BY_STATE:
                // do nothing
                break;
            }
        },

        sort: function () {
            if ( this._sorted ) {
                return;
            }

            var bins = this._bins;
            var keys = window.Object.keys( bins );
            for ( var i = 0, l = keys.length; i < l; i++ ) {
                bins[ keys[ i ] ].sort();
            }
            this.sortImplementation();

            this._sorted = true;
        },

        setParent: function ( parent ) {
            this._parent = parent;
        },
        getParent: function () {
            return this._parent;
        },
        getBinNumber: function () {
            return this._binNum;
        },
        findOrInsert: function ( binNum, binName ) {
            var bin = this._bins[ binNum ];
            if ( bin === undefined ) {
                bin = this._createRenderBin( binName );
                bin._parent = this;
                bin._binNum = binNum;
                bin._renderStage = this._renderStage;
                this._bins[ binNum ] = bin;
            }
            return bin;
        },
        getStage: function () {
            return this._renderStage;
        },
        addStateGraph: function ( sg ) {
            this.stateGraphList.push( sg );
        },
        reset: function () {
            this.stateGraphList.length = 0;
            this._bins = {};
            this.positionedAttribute.length = 0;
            this._leafs.length = 0;
            this._sorted = false;
        },
        applyPositionedAttribute: function ( state, positionedAttibutes ) {
            // the idea is to set uniform 'globally' in uniform map.
            for ( var index = 0, l = positionedAttibutes.length; index < l; index++ ) {
                var element = positionedAttibutes[ index ];
                // add or set uniforms in state
                var stateAttribute = element[ 1 ];
                var matrix = element[ 0 ];
                state.setGlobalDefaultValue( stateAttribute );
                stateAttribute.apply( state );
                stateAttribute.applyPositionedUniform( matrix, state );
                state.haveAppliedAttribute( stateAttribute );
            }
        },

        drawImplementation: function ( state, previousRenderLeaf ) {
            var previous = previousRenderLeaf;
            var binsKeys = window.Object.keys( this._bins );
            var bins = this._bins;
            var binsArray = [];
            for ( var i = 0, l = binsKeys.length; i < l; i++ ) {
                var k = binsKeys[ i ];
                binsArray.push( bins[ k ] );
            }
            var cmp = function ( a, b ) {
                return a._binNum - b._binNum;
            };
            binsArray.sort( cmp );

            var current = 0;
            var end = binsArray.length;

            var bin;
            // draw pre bins
            for ( ; current < end; current++ ) {
                bin = binsArray[ current ];
                if ( bin.getBinNumber() > 0 ) {
                    break;
                }
                previous = bin.drawImplementation( state, previous );
            }

            // draw leafs
            previous = this.drawLeafs( state, previous );

            // draw post bins
            for ( ; current < end; current++ ) {
                bin = binsArray[ current ];
                previous = bin.drawImplementation( state, previous );
            }
            return previous;
        },

        drawGeometry: ( function() {
            var normal = Matrix.create();
            var modelViewUniform, projectionUniform, normalUniform, program;

            return function( state, leaf, push ) {

                var gl = state.getGraphicContext();

                if ( push === true ) {

                    state.apply();
                    program = state.getLastProgramApplied();

                    modelViewUniform = program.uniformsCache.getMapContent()[ state.modelViewMatrix.name ];
                    projectionUniform = program.uniformsCache.getMapContent()[ state.projectionMatrix.name ];
                    normalUniform = program.uniformsCache.getMapContent()[ state.normalMatrix.name ];
                }


                if ( modelViewUniform !== undefined ) {
                    state.modelViewMatrix.set( leaf.modelview );
                    state.modelViewMatrix.apply( gl, modelViewUniform );
                }

                if ( projectionUniform !== undefined ) {
                    state.projectionMatrix.set( leaf.projection );
                    state.projectionMatrix.apply( gl, projectionUniform );
                }

                if ( normalUniform !== undefined ) {
                    Matrix.copy( leaf.modelview, normal );
                    normal[ 12 ] = 0.0;
                    normal[ 13 ] = 0.0;
                    normal[ 14 ] = 0.0;

                    Matrix.inverse( normal, normal );
                    Matrix.transpose( normal, normal );
                    state.normalMatrix.set( normal );
                    state.normalMatrix.apply( gl, normalUniform );
                }

                leaf.geometry.drawImplementation( state );

                if ( push === true ) {
                    state.popGeneratedProgram();
                    state.popStateSet();
                }

            };
        })(),

        drawLeafs: function ( state, previousRenderLeaf ) {
            var stateList = this.stateGraphList;
            var leafs = this._leafs;
            var previousLeaf = previousRenderLeaf;

            if ( previousLeaf ) {
                StateGraph.prototype.moveToRootStateGraph( state, previousRenderLeaf.parent );
            }

            var leaf, push;
            var prevRenderGraph, prevRenderGraphParent, rg;

            // draw fine grained ordering.
            for ( var d = 0, dl = leafs.length; d < dl; d++ ) {
                leaf = leafs[ d ];
                push = false;
                if ( previousLeaf !== undefined ) {

                    // apply state if required.
                    prevRenderGraph = previousLeaf.parent;
                    prevRenderGraphParent = prevRenderGraph.parent;
                    rg = leaf.parent;
                    if ( prevRenderGraphParent !== rg.parent ) {
                        rg.moveStateGraph( state, prevRenderGraphParent, rg.parent );

                        // send state changes and matrix changes to OpenGL.
                        state.pushStateSet( rg.stateset );
                        push = true;
                    } else if ( rg !== prevRenderGraph ) {
                        // send state changes and matrix changes to OpenGL.
                        state.pushStateSet( rg.stateset );
                        push = true;
                    }

                } else {
                    leaf.parent.moveStateGraph( state, undefined, leaf.parent.parent );
                    state.pushStateSet( leaf.parent.stateset );
                    push = true;
                }

                this.drawGeometry( state, leaf, push );

                previousLeaf = leaf;
            }


            // draw coarse grained ordering.
            for ( var i = 0, l = stateList.length; i < l; i++ ) {
                var sg = stateList[ i ];
                for ( var j = 0, ll = sg.leafs.length; j < ll; j++ ) {

                    leaf = sg.leafs[ j ];
                    push = false;
                    if ( previousLeaf !== undefined ) {

                        // apply state if required.
                        prevRenderGraph = previousLeaf.parent;
                        prevRenderGraphParent = prevRenderGraph.parent;
                        rg = leaf.parent;
                        if ( prevRenderGraphParent !== rg.parent ) {
                            rg.moveStateGraph( state, prevRenderGraphParent, rg.parent );

                            // send state changes and matrix changes to OpenGL.
                            state.pushStateSet( rg.stateset );
                            push = true;
                        } else if ( rg !== prevRenderGraph ) {
                            // send state changes and matrix changes to OpenGL.
                            state.pushStateSet( rg.stateset );
                            push = true;
                        }

                    } else {
                        leaf.parent.moveStateGraph( state, undefined, leaf.parent.parent );
                        state.pushStateSet( leaf.parent.stateset );
                        push = true;
                    }

                    this.drawGeometry( state, leaf, push );

                    previousLeaf = leaf;
                }
            }
            return previousLeaf;
        }
    };

    return RenderBin;
} );

define( 'osg/FrameBufferObject',[
    'osg/Notify',
    'osg/Utils',
    'osg/StateAttribute'
], function ( Notify, MACROUTILS, StateAttribute ) {

    /**
     * FrameBufferObject manage fbo / rtt
     * @class FrameBufferObject
     */
    var FrameBufferObject = function () {
        StateAttribute.call( this );
        this.fbo = undefined;
        this.attachments = [];
        this.dirty();
    };

    FrameBufferObject.COLOR_ATTACHMENT0 = 0x8CE0;
    FrameBufferObject.DEPTH_ATTACHMENT = 0x8D00;
    FrameBufferObject.DEPTH_COMPONENT16 = 0x81A5;

    /** @lends FrameBufferObject.prototype */
    FrameBufferObject.prototype = MACROUTILS.objectInehrit( StateAttribute.prototype, {
        attributeType: 'FrameBufferObject',
        cloneType: function () {
            return new FrameBufferObject();
        },
        getType: function () {
            return this.attributeType;
        },
        getTypeMember: function () {
            return this.attributeType;
        },
        setAttachment: function ( attachment ) {
            this.attachments.push( attachment );
        },
        _reportFrameBufferError: function ( code ) {
            switch ( code ) {
            case 0x8CD6:
                Notify.debug( 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT' );
                break;
            case 0x8CD7:
                Notify.debug( 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT' );
                break;
            case 0x8CD9:
                Notify.debug( 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS' );
                break;
            case 0x8CDD:
                Notify.debug( 'FRAMEBUFFER_UNSUPPORTED' );
                break;
            default:
                Notify.debug( 'FRAMEBUFFER unknown error ' + code.toString( 16 ) );
            }
        },
        apply: function ( state ) {
            var gl = state.getGraphicContext();
            var status;
            if ( this.attachments.length > 0 ) {
                if ( this.isDirty() ) {

                    if ( !this.fbo ) {
                        this.fbo = gl.createFramebuffer();
                    }

                    gl.bindFramebuffer( gl.FRAMEBUFFER, this.fbo );
                    var hasRenderBuffer = false;
                    for ( var i = 0, l = this.attachments.length; i < l; ++i ) {

                        if ( this.attachments[ i ].texture === undefined ) { // render buffer
                            var rb = gl.createRenderbuffer();
                            gl.bindRenderbuffer( gl.RENDERBUFFER, rb );
                            gl.renderbufferStorage( gl.RENDERBUFFER, this.attachments[ i ].format, this.attachments[ i ].width, this.attachments[ i ].height );
                            gl.framebufferRenderbuffer( gl.FRAMEBUFFER, this.attachments[ i ].attachment, gl.RENDERBUFFER, rb );
                            hasRenderBuffer = true;
                        } else {
                            var texture = this.attachments[ i ].texture;
                            // apply on unit 0 to init it
                            state.applyTextureAttribute( 0, texture );

                            gl.framebufferTexture2D( gl.FRAMEBUFFER, this.attachments[ i ].attachment, texture.getTextureTarget(), texture.getTextureObject().id(), this.attachments[ i ].level );
                        }
                    }
                    status = gl.checkFramebufferStatus( gl.FRAMEBUFFER );
                    if ( status !== 0x8CD5 ) {
                        this._reportFrameBufferError( status );
                    }

                    if ( hasRenderBuffer ) { // set it to null only if used renderbuffer
                        gl.bindRenderbuffer( gl.RENDERBUFFER, null );
                    }
                    this.setDirty( false );
                } else {
                    gl.bindFramebuffer( gl.FRAMEBUFFER, this.fbo );
                    if ( Notify.reportWebGLError === true ) {
                        status = gl.checkFramebufferStatus( gl.FRAMEBUFFER );
                        if ( status !== 0x8CD5 ) {
                            this._reportFrameBufferError( status );
                        }
                    }
                }
            } else {
                gl.bindFramebuffer( gl.FRAMEBUFFER, null );
            }
        }
    } );

    return FrameBufferObject;
} );

define( 'osg/RenderStage',[
    'osg/Notify',
    'osg/Utils',
    'osg/RenderBin',
    'osg/Camera',
    'osg/FrameBufferObject'
], function ( Notify, MACROUTILS, RenderBin, Camera, FrameBufferObject ) {

    /**
     * From OpenSceneGraph http://www.openscenegraph.org
     * RenderStage base class. Used for encapsulate a complete stage in
     * rendering - setting up of viewport, the projection and model
     * matrices and rendering the RenderBin's enclosed with this RenderStage.
     * RenderStage also has a dependency list of other RenderStages, each
     * of which must be called before the rendering of this stage.  These
     * 'pre' rendering stages are used for advanced rendering techniques
     * like multistage pixel shading or impostors.
     */
    var RenderStage = function () {
        RenderBin.call( this );
        this.positionedAttribute = [];
        this.clearDepth = 1.0;
        this.clearColor = [ 0.0, 0.0, 0.0, 1.0 ];
        /*jshint bitwise: false */
        this.clearMask = Camera.COLOR_BUFFER_BIT | Camera.DEPTH_BUFFER_BIT;
        /*jshint bitwise: true */
        this.camera = undefined;
        this.viewport = undefined;
        this.preRenderList = [];
        this.postRenderList = [];
        this._renderStage = this;
    };
    RenderStage.prototype = MACROUTILS.objectInehrit( RenderBin.prototype, {
        reset: function () {
            RenderBin.prototype.reset.call( this );
            this.preRenderList.length = 0;
            this.postRenderList.length = 0;
        },
        setClearDepth: function ( depth ) {
            this.clearDepth = depth;
        },
        getClearDepth: function () {
            return this.clearDepth;
        },
        setClearColor: function ( color ) {
            this.clearColor = color;
        },
        getClearColor: function () {
            return this.clearColor;
        },
        setClearMask: function ( mask ) {
            this.clearMask = mask;
        },
        getClearMask: function () {
            return this.clearMask;
        },
        setViewport: function ( vp ) {
            this.viewport = vp;
        },
        getViewport: function () {
            return this.viewport;
        },
        setCamera: function ( camera ) {
            this.camera = camera;
        },
        addPreRenderStage: function ( rs, order ) {
            for ( var i = 0, l = this.preRenderList.length; i < l; i++ ) {
                var render = this.preRenderList[ i ];
                if ( order < render.order ) {
                    break;
                }
            }
            if ( i < this.preRenderList.length ) {
                this.preRenderList = this.preRenderList.splice( i, 0, {
                    'order': order,
                    'renderStage': rs
                } );
            } else {
                this.preRenderList.push( {
                    'order': order,
                    'renderStage': rs
                } );
            }
        },
        addPostRenderStage: function ( rs, order ) {
            for ( var i = 0, l = this.postRenderList.length; i < l; i++ ) {
                var render = this.postRenderList[ i ];
                if ( order < render.order ) {
                    break;
                }
            }
            if ( i < this.postRenderList.length ) {
                this.postRenderList = this.postRenderList.splice( i, 0, {
                    'order': order,
                    'renderStage': rs
                } );
            } else {
                this.postRenderList.push( {
                    'order': order,
                    'renderStage': rs
                } );
            }
        },

        drawPreRenderStages: function ( state, previousRenderLeaf ) {
            var previous = previousRenderLeaf;
            for ( var i = 0, l = this.preRenderList.length; i < l; ++i ) {
                var sg = this.preRenderList[ i ].renderStage;
                previous = sg.draw( state, previous );
            }
            return previous;
        },

        draw: function ( state, previousRenderLeaf ) {
            var previous = this.drawPreRenderStages( state, previousRenderLeaf );
            previous = this.drawImplementation( state, previous );

            previous = this.drawPostRenderStages( state, previous );
            return previous;
        },

        sort: function () {
            for ( var i = 0, l = this.preRenderList.length; i < l; ++i ) {
                this.preRenderList[ i ].renderStage.sort();
            }

            RenderBin.prototype.sort.call( this );

            for ( var j = 0, k = this.postRenderList.length; j < k; ++j ) {
                this.postRenderList[ j ].renderStage.sort();
            }
        },

        drawPostRenderStages: function ( state, previousRenderLeaf ) {
            var previous = previousRenderLeaf;
            for ( var i = 0, l = this.postRenderList.length; i < l; ++i ) {
                var sg = this.postRenderList[ i ].renderStage;
                previous = sg.draw( state, previous );
            }
            return previous;
        },

        applyCamera: function ( state ) {
            var gl = state.getGraphicContext();
            if ( this.camera === undefined ) {
                gl.bindFramebuffer( gl.FRAMEBUFFER, null );
                return;
            }
            var viewport = this.camera.getViewport();
            var fbo = this.camera.frameBufferObject;

            if ( !fbo ) {
                fbo = new FrameBufferObject();
                this.camera.frameBufferObject = fbo;
            }

            if ( fbo.isDirty() ) {
                if ( this.camera.attachments !== undefined ) {
                    for ( var key in this.camera.attachments ) {
                        var a = this.camera.attachments[ key ];
                        var attach;
                        if ( a.texture === undefined ) { //renderbuffer
                            attach = {
                                attachment: key,
                                format: a.format,
                                width: viewport.width(),
                                height: viewport.height()
                            };
                        } else if ( a.texture !== undefined ) {
                            attach = {
                                attachment: key,
                                texture: a.texture,
                                level: a.level
                            };
                            if ( a.format ) {
                                attach.format = a.format;
                            }
                        }
                        fbo.setAttachment( attach );
                    }
                }
            }
            fbo.apply( state );
        },

        drawImplementation: function ( state, previousRenderLeaf ) {
            var gl = state.getGraphicContext();

            this.applyCamera( state );

            if ( this.viewport === undefined ) {
                Notify.log( 'RenderStage does not have a valid viewport' );
            }

            state.applyAttribute( this.viewport );

            /*jshint bitwise: false */
            if ( this.clearMask & gl.COLOR_BUFFER_BIT ) {
                gl.clearColor( this.clearColor[ 0 ], this.clearColor[ 1 ], this.clearColor[ 2 ], this.clearColor[ 3 ] );
            }
            if ( this.clearMask & gl.DEPTH_BUFFER_BIT ) {
                gl.depthMask( true );
                gl.clearDepth( this.clearDepth );
            }
            /*jshint bitwise: true */

            gl.clear( this.clearMask );

            if ( this.positionedAttribute ) {
                this.applyPositionedAttribute( state, this.positionedAttribute );
            }

            var previous = RenderBin.prototype.drawImplementation.call( this, state, previousRenderLeaf );

            return previous;
        }
    } );

    return RenderStage;
} );

/**
 * @author Jordi Torres
 */


define( 'osg/Lod',[
    'osg/Utils',
    'osg/Node',
    'osg/NodeVisitor',
    'osg/Matrix',
    'osg/Vec3'
], function ( MACROUTILS, Node, NodeVisitor, Matrix, Vec3) {
    /**
     *  Lod that can contains child node
     *  @class Lod
     */
    var Lod = function () {
        Node.call( this );
        this.radius = -1;
        this.range = [];
    };
    /** @lends Lod.prototype */
    Lod.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( Node.prototype, {
        // Functions here
        getRadius: function () {
            return this.radius;
        },

        /** Set the object-space reference radius of the volume enclosed by the LOD.
         * Used to determine the bounding sphere of the LOD in the absence of any children.*/
        setRadius: function ( radius ) {
            this.radius = radius;
        },

        addChild: function ( node, min, max ) {
            Node.prototype.addChild.call( this, node );

            if ( this.children.length > this.range.length ) {
                var r = [];
                r.push( [ min, min ] );
                this.range.push( r );
            }
            this.range[ this.children.length - 1 ][ 0 ] = min;
            this.range[ this.children.length - 1 ][ 1 ] = max;
            return true;
        },

        traverse: (function() {

            // avoid to generate variable on the heap to limit garbage collection
            // instead create variable and use the same each time
            var zeroVector = [ 0.0, 0.0, 0.0 ];
            var eye = [ 0.0, 0.0, 0.0 ];
            var viewModel = Matrix.create();

            return function ( visitor ) {
                var traversalMode = visitor.traversalMode;

                switch ( traversalMode ) {

                case NodeVisitor.TRAVERSE_ALL_CHILDREN:

                    for ( var index = 0; index < this.children.length; index++ ) {
                        this.children[ index ].accept( visitor );
                    }
                    break;

                case ( NodeVisitor.TRAVERSE_ACTIVE_CHILDREN ):
                    var requiredRange = 0;

                    // First approximation calculate distance from viewpoint
                    var matrix = visitor.getCurrentModelviewMatrix();
                    Matrix.inverse( matrix, viewModel );
                    Matrix.transformVec3( viewModel, zeroVector, eye );
                    var d = Vec3.distance( eye, this.getBound().center() );
                    requiredRange = d;

                    var numChildren = this.children.length;
                    if ( this.range.length < numChildren ) numChildren = this.range.length;

                    for ( var j = 0; j < numChildren; ++j ) {
                        if ( this.range[ j ][ 0 ] <= requiredRange && requiredRange < this.range[ j ][ 1 ] ) {
                            this.children[ j ].accept( visitor );
                        }
                    }
                    break;

                default:
                    break;
                }
            };
        })()

    } ), 'osg', 'Lod' );

    MACROUTILS.setTypeID( Lod );
    return Lod;
});

define( 'osg/CullVisitor',[
    'osg/Notify',
    'osg/Utils',
    'osg/NodeVisitor',
    'osg/CullSettings',
    'osg/CullStack',
    'osg/Matrix',
    'osg/MatrixTransform',
    'osg/Projection',
    'osg/LightSource',
    'osg/Geometry',
    'osg/RenderStage',
    'osg/Node',
    'osg/Lod',
    'osg/Camera',
    'osg/TransformEnums'
], function ( Notify, MACROUTILS, NodeVisitor, CullSettings, CullStack, Matrix, MatrixTransform, Projection, LightSource, Geometry, RenderStage, Node, Lod, Camera, TransformEnums ) {

    /**
     * CullVisitor traverse the tree and collect Matrix/State for the rendering traverse
     * @class CullVisitor
     */
    var CullVisitor = function () {
        NodeVisitor.call( this, NodeVisitor.TRAVERSE_ACTIVE_CHILDREN);
        CullSettings.call( this );
        CullStack.call( this );

        this._rootStateGraph = undefined;
        this._currentStateGraph = undefined;
        this._currentRenderBin = undefined;
        this._currentRenderStage = undefined;
        this._rootRenderStage = undefined;

        this._computedNear = Number.POSITIVE_INFINITY;
        this._computedFar = Number.NEGATIVE_INFINITY;

        var lookVector = [ 0.0, 0.0, -1.0 ];

        /*jshint bitwise: false */
        this._bbCornerFar = ( lookVector[ 0 ] >= 0 ? 1 : 0 ) | ( lookVector[ 1 ] >= 0 ? 2 : 0 ) | ( lookVector[ 2 ] >= 0 ? 4 : 0 );
        this._bbCornerNear = ( ~this._bbCornerFar ) & 7;
        /*jshint bitwise: true */


        // keep a matrix in memory to avoid to create matrix
        this._reserveMatrixStack = [
            []
        ];
        this._reserveMatrixStack.current = 0;

        this._reserveLeafStack = [ {} ];
        this._reserveLeafStack.current = 0;

        this._renderBinStack = [];
    };

    /** @lends CullVisitor.prototype */
    CullVisitor.prototype = MACROUTILS.objectInehrit( CullStack.prototype, MACROUTILS.objectInehrit( CullSettings.prototype, MACROUTILS.objectInehrit( NodeVisitor.prototype, {
        distance: function ( coord, matrix ) {
            return -( coord[ 0 ] * matrix[ 2 ] + coord[ 1 ] * matrix[ 6 ] + coord[ 2 ] * matrix[ 10 ] + matrix[ 14 ] );
        },

        handleCullCallbacksAndTraverse: function ( node ) {
            var ccb = node.getCullCallback();
            if ( ccb ) {
                if ( !ccb.cull( node, this ) ) {
                    return;
                }
            }
            this.traverse( node );
        },

        updateCalculatedNearFar: function ( matrix, drawable ) {

            var bb = drawable.getBoundingBox();
            var dNear, dFar;

            // efficient computation of near and far, only taking into account the nearest and furthest
            // corners of the bounding box.
            dNear = this.distance( bb.corner( this._bbCornerNear ), matrix );
            dFar = this.distance( bb.corner( this._bbCornerFar ), matrix );

            if ( dNear > dFar ) {
                var tmp = dNear;
                dNear = dFar;
                dFar = tmp;
            }

            if ( dFar < 0.0 ) {
                // whole object behind the eye point so discard
                return false;
            }

            if ( dNear < this._computedNear ) {
                this._computedNear = dNear;
            }

            if ( dFar > this._computedFar ) {
                this._computedFar = dFar;
            }

            return true;
        },

        clampProjectionMatrix: function ( projection, znear, zfar, nearFarRatio, resultNearFar ) {
            var epsilon = 1e-6;
            if ( zfar < znear - epsilon ) {
                Notify.log( 'clampProjectionMatrix not applied, invalid depth range, znear = ' + znear + '  zfar = ' + zfar );
                return false;
            }

            var desiredZnear, desiredZfar;
            if ( zfar < znear + epsilon ) {
                // znear and zfar are too close together and could cause divide by zero problems
                // late on in the clamping code, so move the znear and zfar apart.
                var average = ( znear + zfar ) * 0.5;
                znear = average - epsilon;
                zfar = average + epsilon;
                // OSG_INFO << '_clampProjectionMatrix widening znear and zfar to '<<znear<<' '<<zfar<<std::endl;
            }

            if ( Math.abs( Matrix.get( projection, 0, 3 ) ) < epsilon &&
                Math.abs( Matrix.get( projection, 1, 3 ) ) < epsilon &&
                Math.abs( Matrix.get( projection, 2, 3 ) ) < epsilon ) {
                // OSG_INFO << 'Orthographic matrix before clamping'<<projection<<std::endl;

                var deltaSpan = ( zfar - znear ) * 0.02;
                if ( deltaSpan < 1.0 ) {
                    deltaSpan = 1.0;
                }
                desiredZnear = znear - deltaSpan;
                desiredZfar = zfar + deltaSpan;

                // assign the clamped values back to the computed values.
                znear = desiredZnear;
                zfar = desiredZfar;

                Matrix.set( projection, 2, 2, -2.0 / ( desiredZfar - desiredZnear ) );
                Matrix.set( projection, 3, 2, -( desiredZfar + desiredZnear ) / ( desiredZfar - desiredZnear ) );

                // OSG_INFO << 'Orthographic matrix after clamping '<<projection<<std::endl;
            } else {

                // OSG_INFO << 'Persepective matrix before clamping'<<projection<<std::endl;
                //std::cout << '_computed_znear'<<_computed_znear<<std::endl;
                //std::cout << '_computed_zfar'<<_computed_zfar<<std::endl;

                var zfarPushRatio = 1.02;
                var znearPullRatio = 0.98;

                //znearPullRatio = 0.99;

                desiredZnear = znear * znearPullRatio;
                desiredZfar = zfar * zfarPushRatio;

                // near plane clamping.
                var minNearPlane = zfar * nearFarRatio;
                if ( desiredZnear < minNearPlane ) {
                    desiredZnear = minNearPlane;
                }

                // assign the clamped values back to the computed values.
                znear = desiredZnear;
                zfar = desiredZfar;

                var m22 = Matrix.get( projection, 2, 2 );
                var m32 = Matrix.get( projection, 3, 2 );
                var m23 = Matrix.get( projection, 2, 3 );
                var m33 = Matrix.get( projection, 3, 3 );
                var transNearPlane = ( -desiredZnear * m22 + m32 ) / ( -desiredZnear * m23 + m33 );
                var transFarPlane = ( -desiredZfar * m22 + m32 ) / ( -desiredZfar * m23 + m33 );

                var ratio = Math.abs( 2.0 / ( transNearPlane - transFarPlane ) );
                var center = -( transNearPlane + transFarPlane ) / 2.0;

                var matrix = [ 1.0, 0.0, 0.0, 0.0,
                    0.0, 1.0, 0.0, 0.0,
                    0.0, 0.0, ratio, 0.0,
                    0.0, 0.0, center * ratio, 1.0
                ];
                Matrix.postMult( matrix, projection );
                // OSG_INFO << 'Persepective matrix after clamping'<<projection<<std::endl;
            }
            if ( resultNearFar !== undefined ) {
                resultNearFar[ 0 ] = znear;
                resultNearFar[ 1 ] = zfar;
            }
            return true;
        },

        setStateGraph: function ( sg ) {
            this._rootStateGraph = sg;
            this._currentStateGraph = sg;
        },
        setRenderStage: function ( rg ) {
            this._rootRenderStage = rg;
            this._currentRenderBin = rg;
        },
        reset: function () {
            //this._modelviewMatrixStack.length = 0;
            this._modelviewMatrixStack.splice( 0, this._modelviewMatrixStack.length );
            //this._projectionMatrixStack.length = 0;
            this._projectionMatrixStack.splice( 0, this._projectionMatrixStack.length );
            this._reserveMatrixStack.current = 0;
            this._reserveLeafStack.current = 0;

            this._computedNear = Number.POSITIVE_INFINITY;
            this._computedFar = Number.NEGATIVE_INFINITY;
        },
        getCurrentRenderBin: function () {
            return this._currentRenderBin;
        },
        setCurrentRenderBin: function ( rb ) {
            this._currentRenderBin = rb;
        },
        addPositionedAttribute: function ( attribute ) {
            var matrix = this._modelviewMatrixStack[ this._modelviewMatrixStack.length - 1 ];
            this._currentRenderBin.getStage().positionedAttribute.push( [ matrix, attribute ] );
        },

        pushStateSet: function ( stateset ) {
            this._currentStateGraph = this._currentStateGraph.findOrInsert( stateset );
            if ( stateset.getBinName() !== undefined ) {
                var renderBinStack = this._renderBinStack;
                var currentRenderBin = this._currentRenderBin;
                renderBinStack.push( currentRenderBin );
                this._currentRenderBin = currentRenderBin.getStage().findOrInsert( stateset.getBinNumber(), stateset.getBinName() );
            }
        },

        /** Pop the top state set and hence associated state group.
         * Move the current state group to the parent of the popped
         * state group.
         */
        popStateSet: function () {
            var currentStateGraph = this._currentStateGraph;
            var stateset = currentStateGraph.getStateSet();
            this._currentStateGraph = currentStateGraph.parent;
            if ( stateset.getBinName() !== undefined ) {
                var renderBinStack = this._renderBinStack;
                if ( renderBinStack.length === 0 ) {
                    this._currentRenderBin = this._currentRenderBin.getStage();
                } else {
                    this._currentRenderBin = renderBinStack.pop();
                }
            }
        },

        popProjectionMatrix: function () {
            if ( this._computeNearFar === true && this._computedFar >= this._computedNear ) {
                var m = this._projectionMatrixStack[ this._projectionMatrixStack.length - 1 ];
                this.clampProjectionMatrix( m, this._computedNear, this._computedFar, this._nearFarRatio );
            }
            CullStack.prototype.popProjectionMatrix.call( this );
        },

        apply: function ( node ) {
            this[ node.typeID ].call( this, node );
        },

        _getReservedMatrix: function () {
            var m = this._reserveMatrixStack[ this._reserveMatrixStack.current++ ];
            if ( this._reserveMatrixStack.current === this._reserveMatrixStack.length ) {
                this._reserveMatrixStack.push( Matrix.create() );
            }
            return m;
        },
        _getReservedLeaf: function () {
            var l = this._reserveLeafStack[ this._reserveLeafStack.current++ ];
            if ( this._reserveLeafStack.current === this._reserveLeafStack.length ) {
                this._reserveLeafStack.push( {} );
            }
            return l;
        }
    } ) ) );

    CullVisitor.prototype[ Camera.typeID ] = function ( camera ) {

        var stateset = camera.getStateSet();
        if ( stateset ) {
            this.pushStateSet( stateset );
        }

        if ( camera.light ) {
            this.addPositionedAttribute( camera.light );
        }

        // never used
        //var originalModelView = this._modelviewMatrixStack[ this._modelviewMatrixStack.length - 1 ];

        var modelview = this._getReservedMatrix();
        var projection = this._getReservedMatrix();

        if ( camera.getReferenceFrame() === TransformEnums.RELATIVE_RF ) {
            var lastProjectionMatrix = this._projectionMatrixStack[ this._projectionMatrixStack.length - 1 ];
            Matrix.mult( lastProjectionMatrix, camera.getProjectionMatrix(), projection );
            var lastViewMatrix = this._modelviewMatrixStack[ this._modelviewMatrixStack.length - 1 ];
            Matrix.mult( lastViewMatrix, camera.getViewMatrix(), modelview );
        } else {
            // absolute
            Matrix.copy( camera.getViewMatrix(), modelview );
            Matrix.copy( camera.getProjectionMatrix(), projection );
        }
        this.pushProjectionMatrix( projection );
        this.pushModelviewMatrix( modelview );

        if ( camera.getViewport() ) {
            this.pushViewport( camera.getViewport() );
        }

        // save current state of the camera
        var previousZnear = this._computedNear;
        var previousZfar = this._computedFar;
        var previousCullsettings = new CullSettings();
        previousCullsettings.setCullSettings( this );

        this._computedNear = Number.POSITIVE_INFINITY;
        this._computedFar = Number.NEGATIVE_INFINITY;
        this.setCullSettings( camera );

        // nested camera
        if ( camera.getRenderOrder() === Camera.NESTED_RENDER ) {

            this.handleCullCallbacksAndTraverse( camera );

        } else {
            // not tested

            var previousStage = this.getCurrentRenderBin().getStage();

            // use render to texture stage
            var rtts = new RenderStage();
            rtts.setCamera( camera );
            rtts.setClearDepth( camera.getClearDepth() );
            rtts.setClearColor( camera.getClearColor() );

            rtts.setClearMask( camera.getClearMask() );

            var vp;
            if ( camera.getViewport() === undefined ) {
                vp = previousStage.getViewport();
            } else {
                vp = camera.getViewport();
            }
            rtts.setViewport( vp );

            // skip positional state for now
            // ...

            var previousRenderBin = this.getCurrentRenderBin();

            this.setCurrentRenderBin( rtts );

            this.handleCullCallbacksAndTraverse( camera );

            this.setCurrentRenderBin( previousRenderBin );

            if ( camera.getRenderOrder() === Camera.PRE_RENDER ) {
                this.getCurrentRenderBin().getStage().addPreRenderStage( rtts, camera.renderOrderNum );
            } else {
                this.getCurrentRenderBin().getStage().addPostRenderStage( rtts, camera.renderOrderNum );
            }
        }

        this.popModelviewMatrix();
        this.popProjectionMatrix();

        if ( camera.getViewport() ) {
            this.popViewport();
        }

        // restore previous state of the camera
        this.setCullSettings( previousCullsettings );
        this._computedNear = previousZnear;
        this._computedFar = previousZfar;

        if ( stateset ) {
            this.popStateSet();
        }

    };


    CullVisitor.prototype[ MatrixTransform.typeID ] = function ( node ) {
        var matrix = this._getReservedMatrix();

        if ( node.getReferenceFrame() === TransformEnums.RELATIVE_RF ) {
            var lastMatrixStack = this._modelviewMatrixStack[ this._modelviewMatrixStack.length - 1 ];
            Matrix.mult( lastMatrixStack, node.getMatrix(), matrix );
        } else {
            // absolute
            Matrix.copy( node.getMatrix(), matrix );
        }
        this.pushModelviewMatrix( matrix );


        var stateset = node.getStateSet();
        if ( stateset ) {
            this.pushStateSet( stateset );
        }

        if ( node.light ) {
            this.addPositionedAttribute( node.light );
        }

        this.handleCullCallbacksAndTraverse( node );

        if ( stateset ) {
            this.popStateSet();
        }

        this.popModelviewMatrix();

    };

    CullVisitor.prototype[ Projection.typeID ] = function ( node ) {
        var lastMatrixStack = this._projectionMatrixStack[ this._projectionMatrixStack.length - 1 ];
        var matrix = this._getReservedMatrix();
        Matrix.mult( lastMatrixStack, node.getProjectionMatrix(), matrix );
        this.pushProjectionMatrix( matrix );

        var stateset = node.getStateSet();

        if ( stateset ) {
            this.pushStateSet( stateset );
        }

        this.handleCullCallbacksAndTraverse( node );

        if ( stateset ) {
            this.popStateSet();
        }

        this.popProjectionMatrix();
    };

    CullVisitor.prototype[ Node.typeID ] = function ( node ) {

        var stateset = node.getStateSet();
        if ( stateset ) {
            this.pushStateSet( stateset );
        }
        if ( node.light ) {
            this.addPositionedAttribute( node.light );
        }

        this.handleCullCallbacksAndTraverse( node );

        if ( stateset ) {
            this.popStateSet();
        }
    };

    // same code like Node
    CullVisitor.prototype[ Lod.typeID ] = CullVisitor.prototype[ Node.typeID ];

    CullVisitor.prototype[ LightSource.typeID ] = function ( node ) {

        var stateset = node.getStateSet();
        if ( stateset ) {
            this.pushStateSet( stateset );
        }

        var light = node.getLight();
        if ( light ) {
            this.addPositionedAttribute( light );
        }

        this.handleCullCallbacksAndTraverse( node );

        if ( stateset ) {
            this.popStateSet();
        }
    };

    CullVisitor.prototype[ Geometry.typeID ] = function ( node ) {
        var modelview = this._modelviewMatrixStack[ this._modelviewMatrixStack.length - 1 ];
        var bb = node.getBoundingBox();
        if ( this._computeNearFar && bb.valid() ) {
            if ( !this.updateCalculatedNearFar( modelview, node ) ) {
                return;
            }
        }

        var stateset = node.getStateSet();
        if ( stateset ) {
            this.pushStateSet( stateset );
        }

        this.handleCullCallbacksAndTraverse( node );

        var leafs = this._currentStateGraph.leafs;
        if ( leafs.length === 0 ) {
            this._currentRenderBin.addStateGraph( this._currentStateGraph );
        }

        var leaf = this._getReservedLeaf();
        var depth = 0;
        if ( bb.valid() ) {
            depth = this.distance( bb.center(), modelview );
        }
        if ( isNaN( depth ) ) {
            Notify.warn( 'warning geometry has a NaN depth, ' + modelview + ' center ' + bb.center() );
        } else {
            //leaf.id = this._reserveLeafStack.current;
            leaf.parent = this._currentStateGraph;
            leaf.projection = this._projectionMatrixStack[ this._projectionMatrixStack.length - 1 ];
            leaf.geometry = node;
            leaf.modelview = modelview;
            leaf.depth = depth;
            leafs.push( leaf );
        }

        if ( stateset ) {
            this.popStateSet();
        }
    };

    return CullVisitor;
} );

define( 'osg/Depth',[
    'osg/Utils',
    'osg/StateAttribute'
], function ( MACROUTILS, StateAttribute ) {

    var Depth = function ( func, near, far, writeMask ) {
        StateAttribute.call( this );

        this._func = Depth.LESS;
        this._near = 0.0;
        this._far = 1.0;
        this._writeMask = true;

        if ( func !== undefined ) {
            if ( typeof ( func ) === 'string' ) {
                this._func = Depth[ func ];
            } else {
                this._func = func;
            }
        }
        if ( near !== undefined ) {
            this._near = near;
        }
        if ( far !== undefined ) {
            this._far = far;
        }
        if ( writeMask !== undefined ) {
            this._writeMask = writeMask;
        }
    };

    Depth.DISABLE = 0x0000;
    Depth.NEVER = 0x0200;
    Depth.LESS = 0x0201;
    Depth.EQUAL = 0x0202;
    Depth.LEQUAL = 0x0203;
    Depth.GREATE = 0x0204;
    Depth.NOTEQU = 0x0205;
    Depth.GEQUAL = 0x0206;
    Depth.ALWAYS = 0x0207;

    Depth.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( StateAttribute.prototype, {
        attributeType: 'Depth',
        cloneType: function () {
            return new Depth();
        },
        getType: function () {
            return this.attributeType;
        },
        getTypeMember: function () {
            return this.attributeType;
        },
        setRange: function ( near, far ) {
            this._near = near;
            this._far = far;
        },
        setWriteMask: function ( mask ) {
            this._writeMask = mask;
        },
        apply: function ( state ) {
            var gl = state.getGraphicContext();
            if ( this._func === 0 ) {
                gl.disable( gl.DEPTH_TEST );
            } else {
                gl.enable( gl.DEPTH_TEST );
                gl.depthFunc( this._func );
                gl.depthMask( this._writeMask );
                gl.depthRange( this._near, this._far );
            }
        }
    } ), 'osg', 'Depth' );

    return Depth;
} );

define( 'osg/DrawArrayLengths',[
], function () {

    /**
     * DrawArrayLengths manage rendering primitives
     * @class DrawArrayLengths
     */
    var DrawArrayLengths = function ( mode, first, array ) {
        this._mode = mode;
        this._first = first;
        this._arrayLengths = array.slice( 0 );
    };

    /** @lends DrawArrayLengths.prototype */
    DrawArrayLengths.prototype = {
        draw: function ( state ) {
            var gl = state.getGraphicContext();
            var mode = this._mode;
            var first = this._first;
            var array = this._arrayLengths;
            for ( var i = 0, l = array.length; i < l; i++ ) {
                var count = array[ i ];
                gl.drawArrays( mode, first, count );
                first += count;
            }
        },
        getMode: function () {
            return this._mode;
        },
        getNumIndices: function () {
            var count = 0;
            var array = this._arrayLengths;
            for ( var i = 0, l = array.length; i < l; i++ ) {
                count += array[ i ];
            }
            return count;
        },
        getArrayLengths: function () {
            return this._arrayLengths;
        },
        getFirst: function () {
            return this._first;
        },
        setFirst: function ( first ) {
            this._first = first;
        }
    };

    return DrawArrayLengths;
} );

define( 'osg/PrimitiveSet',[], function () {

    var PrimitiveSet = {};
    PrimitiveSet.POINTS = 0x0000;
    PrimitiveSet.LINES = 0x0001;
    PrimitiveSet.LINE_LOOP = 0x0002;
    PrimitiveSet.LINE_STRIP = 0x0003;
    PrimitiveSet.TRIANGLES = 0x0004;
    PrimitiveSet.TRIANGLE_STRIP = 0x0005;
    PrimitiveSet.TRIANGLE_FAN = 0x0006;

    return PrimitiveSet;
} );

define( 'osg/DrawArrays',[
    'osg/Notify',
    'osg/PrimitiveSet'
], function ( Notify, PrimitiveSet ) {

    /**
     * DrawArrays manage rendering primitives
     * @class DrawArrays
     */
    var DrawArrays = function ( mode, first, count ) {
        this.mode = mode;
        if ( mode !== undefined ) {
            if ( typeof ( mode ) === 'string' ) {
                mode = PrimitiveSet[ mode ];
            }
            this.mode = mode;
        }
        this.first = first;
        this.count = count;
    };

    /** @lends DrawArrays.prototype */
    DrawArrays.prototype = {
        draw: function ( state ) {
            var gl = state.getGraphicContext();
            gl.drawArrays( this.mode, this.first, this.count );
        },
        getMode: function () {
            return this.mode;
        },
        getCount: function () {
            return this.count;
        },
        getFirst: function () {
            return this.first;
        }
    };
    DrawArrays.create = function ( mode, first, count ) {
        Notify.log( 'DrawArrays.create is deprecated, use new DrawArrays with same arguments' );
        var d = new DrawArrays( mode, first, count );
        return d;
    };

    return DrawArrays;
} );
define( 'osg/DrawElements',[
    'osg/Notify',
    'osg/PrimitiveSet'
], function ( Notify, PrimitiveSet ) {

    /**
     * DrawElements manage rendering of indexed primitives
     * @class DrawElements
     */
    var DrawElements = function ( mode, indices ) {
        this.mode = PrimitiveSet.POINTS;
        if ( mode !== undefined ) {
            if ( typeof ( mode ) === 'string' ) {
                mode = PrimitiveSet[ mode ];
            }
            this.mode = mode;
        }
        this.count = 0;
        this.offset = 0;
        this.indices = indices;
        if ( indices !== undefined ) {
            this.setIndices( indices );
        }
    };

    /** @lends DrawElements.prototype */
    DrawElements.prototype = {
        getMode: function () {
            return this.mode;
        },
        draw: function ( state ) {
            state.setIndexArray( this.indices );
            var gl = state.getGraphicContext();
            gl.drawElements( this.mode, this.count, gl.UNSIGNED_SHORT, this.offset );
        },
        setIndices: function ( indices ) {
            this.indices = indices;
            this.count = indices.getElements().length;
        },
        getIndices: function () {
            return this.indices;
        },
        setFirst: function ( val ) {
            this.offset = val;
        },
        getFirst: function () {
            return this.offset;
        },
        setCount: function ( val ) {
            this.count = val;
        },
        getCount: function () {
            return this.count;
        }

    };

    DrawElements.create = function ( mode, indices ) {
        Notify.log( 'DrawElements.create is deprecated, use new DrawElements with same arguments' );
        return new DrawElements( mode, indices );
    };

    return DrawElements;
} );
define( 'osg/EllipsoidModel',[
    'osg/Notify',
    'osg/Matrix',
    'osg/Vec3'
], function ( Notify, Matrix, Vec3 ) {

    var EllipsoidModel = function () {
        this._radiusEquator = EllipsoidModel.WGS_84_RADIUS_EQUATOR;
        this._radiusPolar = EllipsoidModel.WGS_84_RADIUS_POLAR;
        this.computeCoefficients();
    };

    EllipsoidModel.WGS_84_RADIUS_EQUATOR = 6378137.0;
    EllipsoidModel.WGS_84_RADIUS_POLAR = 6356752.3142;

    EllipsoidModel.prototype = {
        setRadiusEquator: function ( radius ) {
            this._radiusEquator = radius;
            this.computeCoefficients();
        },
        getRadiusEquator: function () {
            return this._radiusEquator;
        },
        setRadiusPolar: function ( radius ) {
            this._radiusPolar = radius;
            this.computeCoefficients();
        },
        getRadiusPolar: function () {
            return this._radiusPolar;
        },
        convertLatLongHeightToXYZ: function ( latitude, longitude, height, result ) {
            if ( result === undefined ) {
                Notify.warn( 'deprecated, use this signature convertLatLongHeightToXYZ( latitude, longitude, height, result )' );
                result = [ 0.0, 0.0, 0.0 ];
            }
            var sinLatitude = Math.sin( latitude );
            var cosLatitude = Math.cos( latitude );
            var N = this._radiusEquator / Math.sqrt( 1.0 - this._eccentricitySquared * sinLatitude * sinLatitude );
            var X = ( N + height ) * cosLatitude * Math.cos( longitude );
            var Y = ( N + height ) * cosLatitude * Math.sin( longitude );
            var Z = ( N * ( 1.0 - this._eccentricitySquared ) + height ) * sinLatitude;
            result[ 0 ] = X;
            result[ 1 ] = Y;
            result[ 2 ] = Z;
            return result;
        },
        convertXYZToLatLongHeight: function ( X, Y, Z, result ) {
            if ( result === undefined ) {
                Notify.warn( 'deprecated, use this signature convertXYZToLatLongHeight( X,  Y,  Z , result)' );
                result = [ 0.0, 0.0, 0.0 ];
            }
            // http://www.colorado.edu/geography/gcraft/notes/datum/gif/xyzllh.gif
            var p = Math.sqrt( X * X + Y * Y );
            var theta = Math.atan2( Z * this._radiusEquator, ( p * this._radiusPolar ) );
            var eDashSquared = ( this._radiusEquator * this._radiusEquator - this._radiusPolar * this._radiusPolar ) / ( this._radiusPolar * this._radiusPolar );

            var sinTheta = Math.sin( theta );
            var cosTheta = Math.cos( theta );

            var latitude = Math.atan( ( Z + eDashSquared * this._radiusPolar * sinTheta * sinTheta * sinTheta ) /
                ( p - this._eccentricitySquared * this._radiusEquator * cosTheta * cosTheta * cosTheta ) );
            var longitude = Math.atan2( Y, X );

            var sinLatitude = Math.sin( latitude );
            var N = this._radiusEquator / Math.sqrt( 1.0 - this._eccentricitySquared * sinLatitude * sinLatitude );

            var height = p / Math.cos( latitude ) - N;
            result[ 0 ] = latitude;
            result[ 1 ] = longitude;
            result[ 2 ] = height;
            return result;
        },
        computeLocalUpVector: function ( X, Y, Z ) {
            // Note latitude is angle between normal to ellipsoid surface and XY-plane
            var latitude, longitude, altitude;
            var coord = this.convertXYZToLatLongHeight( X, Y, Z, latitude, longitude, altitude );
            latitude = coord[ 0 ];
            longitude = coord[ 1 ];
            altitude = coord[ 2 ];

            // Compute up vector
            return [ Math.cos( longitude ) * Math.cos( latitude ),
                Math.sin( longitude ) * Math.cos( latitude ),
                Math.sin( latitude ) ];
        },
        isWGS84: function () {
            return ( this._radiusEquator === EllipsoidModel.WGS_84_RADIUS_EQUATOR && this._radiusPolar === EllipsoidModel.WGS_84_RADIUS_POLAR );
        },

        computeCoefficients: function () {
            var flattening = ( this._radiusEquator - this._radiusPolar ) / this._radiusEquator;
            this._eccentricitySquared = 2.0 * flattening - flattening * flattening;
        },
        computeLocalToWorldTransformFromLatLongHeight: function ( latitude, longitude, height, result ) {
            if ( result === undefined ) {
                Notify.warn( 'deprecated, use this signature computeLocalToWorldTransformFromLatLongHeight(latitude, longitude, height, result)' );
                result = new Array( 16 );
            }
            var pos = this.convertLatLongHeightToXYZ( latitude, longitude, height, result );
            Matrix.makeTranslate( pos[ 0 ], pos[ 1 ], pos[ 2 ], result );
            this.computeCoordinateFrame( latitude, longitude, result );
            return result;
        },
        computeLocalToWorldTransformFromXYZ: function ( X, Y, Z ) {
            var lla = this.convertXYZToLatLongHeight( X, Y, Z );
            var m = Matrix.makeTranslate( X, Y, Z, Matrix.create() );
            this.computeCoordinateFrame( lla[ 0 ], lla[ 1 ], m );
            return m;
        },
        computeCoordinateFrame: ( function () {
            var up = [ 0.0, 0.0, 0.0 ];
            var east = [ 0.0, 0.0, 0.0 ];
            var north = [ 0.0, 0.0, 0.0 ];
            return function ( latitude, longitude, localToWorld ) {
                // Compute up vector
                up[ 0 ] = Math.cos( longitude ) * Math.cos( latitude );
                up[ 1 ] = Math.sin( longitude ) * Math.cos( latitude );
                up[ 2 ] = Math.sin( latitude );

                // Compute east vector
                east[ 0 ] = -Math.sin( longitude );
                east[ 1 ] = -Math.cos( longitude );

                // Compute north vector = outer product up x east
                Vec3.cross( up, east, north );

                // set matrix
                Matrix.set( localToWorld, 0, 0, east[ 0 ] );
                Matrix.set( localToWorld, 0, 1, east[ 1 ] );
                Matrix.set( localToWorld, 0, 2, east[ 2 ] );

                Matrix.set( localToWorld, 1, 0, north[ 0 ] );
                Matrix.set( localToWorld, 1, 1, north[ 1 ] );
                Matrix.set( localToWorld, 1, 2, north[ 2 ] );

                Matrix.set( localToWorld, 2, 0, up[ 0 ] );
                Matrix.set( localToWorld, 2, 1, up[ 1 ] );
                Matrix.set( localToWorld, 2, 2, up[ 2 ] );
            };
        } )()
    };

    return EllipsoidModel;
} );

define( 'osg/FrameStamp',[
], function () {

    var FrameStamp = function () {
        var frame = 0;
        var startSimulation = 0.0;
        var currentSimulation = 0.0;

        this.setReferenceTime = function ( s ) {
            startSimulation = s;
        };
        this.setSimulationTime = function ( s ) {
            currentSimulation = s;
        };
        this.getReferenceTime = function () {
            return startSimulation;
        };
        this.getSimulationTime = function () {
            return currentSimulation;
        };
        this.setFrameNumber = function ( n ) {
            frame = n;
        };
        this.getFrameNumber = function () {
            return frame;
        };
    };

    return FrameStamp;
} );

define( 'osg/Image',[
    'osg/Utils',
    'osg/Object'
], function ( MACROUTILS, Object ) {

    var Image = function ( image ) {
        Object.call( this );

        this._imageObject = undefined;
        this._url = undefined;
        this._width = undefined;
        this._height = undefined;

        if ( image ) {
            this.setImage( image );
        }

        this._isGreyscale = undefined;
    };

    Image.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInherit( Object.prototype, {

        dirty: function () {
            this._isGreyscale = undefined;
        },
        getImage: function () {
            return this._imageObject;
        },
        getURL: function () {
            return this._url;
        },
        setURL: function ( url ) {
            this._url = url;
        },
        setImage: function ( img ) {
            if ( !this._url && img && img.src ) {
                this._url = img.src;
            }
            this._imageObject = img;
            this.dirty();
        },
        isCanvas: function () {
            return this._imageObject instanceof HTMLCanvasElement;
        },
        isImage: function () {
            return this._imageObject instanceof window.Image;
        },
        isTypedArray: function () {
            return this._imageObject instanceof Uint8Array;
        },
        setWidth: function ( w ) {
            this._width = w;
        },
        setHeight: function ( h ) {
            this._height = h;
        },
        getWidth: function () {
            if ( this.isImage() ) {
                return this._imageObject.naturalWidth;
            } else if ( this.isCanvas() ) {
                return this._imageObject.width;
            }
            return this._width;
        },
        getHeight: function () {
            if ( this.isImage() ) {
                return this._imageObject.naturalHeight;
            } else if ( this.isCanvas() ) {
                return this._imageObject.height;
            }
            return this._height;
        },

        isGreyscale: function ( nbSamples ) {
            if ( this._isGreyscale !== undefined )
                return this._isGreyscale;

            if ( this._imageObject !== undefined && this.isReady() && this._isGreyscale === undefined ) {

                var canvas = this._imageObject;
                if ( !this.isCanvas() ) {
                    canvas = document.createElement( 'canvas' );
                }
                var ctx = canvas.getContext( '2d' );
                canvas.width = this._imageObject.width;
                canvas.height = this._imageObject.height;
                ctx.drawImage( this._imageObject, 0, 0 );

                var sampleX, sampleY;
                // cap sample if needed
                if ( !nbSamples ) {
                    sampleX = canvas.width;
                    sampleY = canvas.height;
                }
                if ( nbSamples > 0 ) {
                    nbSamples = Math.min( Math.min( canvas.width, canvas.height ), nbSamples );
                    sampleX = sampleY = nbSamples;
                }

                var isGreyscale = true;
                var xFactor = canvas.width / (sampleX );
                var yFactor = canvas.height / (sampleY );
                for ( var i = 0; i < sampleX; i++ ) {
                    for ( var j = 0; j < sampleY; j++ ) {
                        var x = Math.floor( xFactor * ( i + 0.5 ) ),
                            y = Math.floor( yFactor * ( j + 0.5 ) );
                        var data = ctx.getImageData( x, y, 1, 1 ).data;
                        if ( !( data[ 0 ] === data[ 1 ] && data[ 0 ] === data[ 2 ]) ) {
                            isGreyscale = false;
                            break;
                        }
                    }
                }
                this._isGreyscale = isGreyscale;
            }

            return this._isGreyscale;
        },

        isReady: function () {

            // image are ready for static data
            if ( this.isCanvas() ||
                this.isTypedArray() ) {
                return true;
            }

            if ( this.isImage() ) {
                var image = this._imageObject;
                if ( image.complete ) {
                    if ( image.naturalWidth !== undefined && image.naturalWidth === 0 ) {
                        return false;
                    }
                    return true;
                }
            }
            return false;
        }
    } ), 'osg', 'Image' );

    MACROUTILS.setTypeID( Image );

    return Image;
} );

define( 'osg/TriangleIndexFunctor',[
    'osg/Vec3',
    'osg/PrimitiveSet'
], function( Vec3, PrimitiveSet ) {

    // This class can be used to visit all the triangles of a geometry
    // You feed it with a callback that will be called for each triangle
    // (with the 3 indexes of vertices as arguments)
    var TriangleIndexFunctor = function( geom, cb ) {
        this._geom = geom;
        this._cb = cb;
    };

    TriangleIndexFunctor.prototype = {
        applyDrawElementsTriangles: function( count, indexes ) {
            var cb = this._cb;
            for ( var i = 0; i < count; i += 3 ) {
                cb( indexes[ i ], indexes[ i + 1 ], indexes[ i + 2 ] );
            }
        },

        applyDrawElementsTriangleStrip: function( count, indexes ) {
            var cb = this._cb;
            for ( var i = 2, j = 0; i < count; ++i, ++j ) {
                if ( i % 2 ) cb( indexes[ j ], indexes[ j + 2 ], indexes[ j + 1 ] );
                else cb( indexes[ j ], indexes[ j + 1 ], indexes[ j + 2 ] );
            }
        },

        applyDrawElementsTriangleFan: function( count, indexes ) {
            var cb = this._cb;
            var first = indexes[ 0 ];
            for ( var i = 2, j = 1; i < count; ++i, ++j ) {
                cb( first, indexes[ j ], indexes[ j + 1 ] );
            }
        },

        applyDrawArraysTriangles: function( first, count ) {
            var cb = this._cb;
            for ( var i = 2, pos = first; i < count; i += 3, pos += 3 ) {
                cb( pos, pos + 1, pos + 2 );
            }
        },

        applyDrawArraysTriangleStrip: function( first, count ) {
            var cb = this._cb;
            for ( var i = 2, pos = first; i < count; ++i, ++pos ) {
                if ( i % 2 ) cb( pos, pos + 2, pos + 1 );
                else cb( pos, pos + 1, pos + 2 );
            }
        },

        applyDrawArraysTriangleFan: function( first, count ) {
            var cb = this._cb;
            for ( var i = 2, pos = first + 1; i < count; ++i, ++pos ) {
                cb( first, pos, pos + 1 );
            }
        },

        apply: function() {
            var geom = this._geom;
            var primitives = geom.primitives;
            if ( !primitives )
                return;
            var nbPrimitives = primitives.length;
            for ( var i = 0; i < nbPrimitives; i++ ) {
                var primitive = primitives[ i ];
                if ( primitive.getIndices !== undefined ) {
                    var indexes = primitive.indices.getElements();
                    switch ( primitive.getMode() ) {
                        case PrimitiveSet.TRIANGLES:
                            this.applyDrawElementsTriangles( primitive.getCount(), indexes );
                            break;
                        case PrimitiveSet.TRIANGLE_STRIP:
                            this.applyDrawElementsTriangleStrip( primitive.getCount(), indexes );
                            break;
                        case PrimitiveSet.TRIANGLE_FAN:
                            this.applyDrawElementsTriangleFan( primitive.getCount(), indexes );
                            break;
                    }
                } else { // draw array
                    switch ( primitive.getMode() ) {
                        case PrimitiveSet.TRIANGLES:
                            this.applyDrawArraysTriangles( primitive.getFirst(), primitive.getCount() );
                            break;
                        case PrimitiveSet.TRIANGLE_STRIP:
                            this.applyDrawArraysTriangleStrip( primitive.getFirst(), primitive.getCount() );
                            break;
                        case PrimitiveSet.TRIANGLE_FAN:
                            this.applyDrawArraysTriangleFan( primitive.getFirst(), primitive.getCount() );
                            break;
                    }
                }
            }
        }
    };

    return TriangleIndexFunctor;
} );

define( 'osgUtil/TriangleIntersect',[
    'osg/Vec3',
    'osg/TriangleIndexFunctor'
], function( Vec3, TriangleIndexFunctor ) {

    var TriangleHit = function( index, normal, r1, v1, r2, v2, r3, v3 ) {
        this.index = index;
        this.normal = normal;
        this.r1 = r1;
        this.v1 = v1;
        this.r2 = r2;
        this.v2 = v2;
        this.r3 = r3;
        this.v3 = v3;
    };

    var TriangleIntersect = function() {
        this.hits = [];
        this.nodePath = [];
        this.index = 0;
    };

    TriangleIntersect.prototype = {
        setNodePath: function( np ) {
            this.nodePath = np;
        },
        set: function( start, end ) {
            this.start = start;
            this.end = end;
            this.dir = Vec3.sub( end, start, [ 0.0, 0.0, 0.0 ] );
            this.length = Vec3.length( this.dir );
            this.invLength = 1.0 / this.length;
            Vec3.mult( this.dir, this.invLength, this.dir );
        },

        apply: function( node ) {
            if ( !node.getAttributes().Vertex ) {
                return;
            }
            var vertices = node.getAttributes().Vertex.getElements();
            var self = this;
            var v1 = [ 0.0, 0.0, 0.0 ];
            var v2 = [ 0.0, 0.0, 0.0 ];
            var v3 = [ 0.0, 0.0, 0.0 ];
            var cb = function( i1, i2, i3 ) {
                if ( i1 === i2 || i1 === i3 || i2 === i3 )
                    return;
                var j = i1 * 3;
                v1[ 0 ] = vertices[ j ];
                v1[ 1 ] = vertices[ j + 1 ];
                v1[ 2 ] = vertices[ j + 2 ];
                j = i2 * 3;
                v2[ 0 ] = vertices[ j ];
                v2[ 1 ] = vertices[ j + 1 ];
                v2[ 2 ] = vertices[ j + 2 ];
                j = i3 * 3;
                v3[ 0 ] = vertices[ j ];
                v3[ 1 ] = vertices[ j + 1 ];
                v3[ 2 ] = vertices[ j + 2 ];
                self.intersect( v1, v2, v3 );
            };
            var tif = new TriangleIndexFunctor( node, cb );
            tif.apply();
        },

        intersect: ( function() {
            var normal = [ 0.0, 0.0, 0.0 ];
            var e2 = [ 0.0, 0.0, 0.0 ];
            var e1 = [ 0.0, 0.0, 0.0 ];
            var tvec = [ 0.0, 0.0, 0.0 ];
            var pvec = [ 0.0, 0.0, 0.0 ];
            var qvec = [ 0.0, 0.0, 0.0 ];
            var epsilon = 1E-20;
            return function( v0, v1, v2 ) {
                this.index++;
                var d = this.dir;

                Vec3.sub( v2, v0, e2 );
                Vec3.sub( v1, v0, e1 );
                Vec3.cross( d, e2, pvec );

                var det = Vec3.dot( pvec, e1 );
                if ( det > -epsilon && det < epsilon )
                    return;
                var invDet = 1.0 / det;

                Vec3.sub( this.start, v0, tvec );

                var u = Vec3.dot( pvec, tvec ) * invDet;
                if ( u < 0.0 || u > 1.0 )
                    return;

                Vec3.cross( tvec, e1, qvec );

                var v = Vec3.dot( qvec, d ) * invDet;
                if ( v < 0.0 || ( u + v ) > 1.0 )
                    return;

                var t = Vec3.dot( qvec, e2 ) * invDet;

                if ( t < epsilon || t > this.length ) //no intersection
                    return;

                var r0 = 1.0 - u - v;
                var r1 = u;
                var r2 = v;
                var r = t * this.invLength;

                var interX = v0[ 0 ] * r0 + v1[ 0 ] * r1 + v2[ 0 ] * r2;
                var interY = v0[ 1 ] * r0 + v1[ 1 ] * r1 + v2[ 1 ] * r2;
                var interZ = v0[ 2 ] * r0 + v1[ 2 ] * r1 + v2[ 2 ] * r2;

                Vec3.cross( e1, e2, normal );
                Vec3.normalize( normal, normal );

                this.hits.push( {
                    'ratio': r,
                    'nodepath': this.nodePath.slice( 0 ),
                    'triangleHit': new TriangleHit( this.index - 1, normal.slice( 0 ), r0, v0.slice( 0 ), r1, v1.slice( 0 ), r2, v2.slice( 0 ) ),
                    'point': [ interX, interY, interZ ]
                } );
                this.hit = true;
            };
        } )()
    };

    return TriangleIntersect;
} );
define( 'osg/KdTree',[
    'osg/Utils',
    'osg/BoundingBox',
    'osg/Vec3',
    'osg/TriangleIndexFunctor',
    'osgUtil/TriangleIntersect',
    'osg/PrimitiveSet'
], function( MACROUTILS, BoundingBox, Vec3, TriangleIndexFunctor, TriangleIntersect, PrimitiveSet ) {

    // **** GENERAL INFO ON KDTREE ****
    // A KdTree is a Spatial Partitionning Tree (http://en.wikipedia.org/wiki/Space_partitioning)
    // The type of tree is sort of defined by the splitting axis method:
    // - Per Axis split (octree/ kdtree)
    // - Arbritrary direction split (bsp)

    // The algorithm used for splitting, the name for finding best split is 'Surface Area Heuristic (SAH)'
    // Octree divide the space in 8 subspace (one box -> 8 sub boxes)
    // whereas kdtree does it by splitting population number in two equal group

    // Kd Tree http://en.wikipedia.org/wiki/K-d_tree
    // a given set of points is sorted along one Axis (e.g. X).
    // The sorted list is split at the median.
    // The result are two sets, one for each half-space (left and right).

    // Then, for the current node, the splitting-plane position (or the median-point) and depth is saved.
    // Finally, if the point-set has more than n point and the tree depth is below m 
    // (with n,m chosen by the user, as build options), two child-nodes (L/R one for each point-set) 
    // are created which themselfs repeat the pocedure.

    // The split-axis gets alternated at each depth, the split order is computed by checking the main
    // bounding box the length of its axis
    // **** GENERAL INFO ON KDTREE ****

    // The KdTree implemented here is flattened, ie, a node and its children all lie in the same array
    // The most important thing is the understanding of the variables first and second for each node
    // Their semantic depend if the node is a leaf or not
    // if it's a leaf :
    //   first and second defines a range in the triangles array (triangles in the cell)
    // if it's not a leaf :
    // - first and second respectively represents the left and right sub children
    // We know that a node is a leaf if first is negative, in that case the range will be defined by
    // [ -first - 1, -first-1 + second ]
    var KdNode = function( first, second ) {
        this._bb = new BoundingBox();
        this._first = first;
        this._second = second;
        // These variables represent the local clipped ray (for intersection test)
        // They are mostly temporary because they are recomputed for each intersection test
        this._nodeRayStart = [ 0.0, 0.0, 0.0 ];
        this._nodeRayEnd = [ 0.0, 0.0, 0.0 ];
    };

    var IntersectKdTree = function( vertices, nodes, triangles, intersections, start, end, nodePath ) {
        this._vertices = vertices;
        this._kdNodes = nodes;
        this._triangles = triangles;
        this._intersector = new TriangleIntersect();
        this._dinvX = [ 0.0, 0.0, 0.0 ];
        this._dinvY = [ 0.0, 0.0, 0.0 ];
        this._dinvZ = [ 0.0, 0.0, 0.0 ];
        this.init( intersections, start, end, nodePath );
    };

    IntersectKdTree.prototype = {
        init: function( intersections, start, end, nodePath ) {
            var d = Vec3.sub( end, start, [ 0.0, 0.0, 0.0 ] );
            var len = Vec3.length( d );
            var invLen = 0.0;
            if ( len !== 0.0 )
                invLen = 1.0 / len;
            Vec3.mult( d, invLen, d );
            if ( d[ 0 ] !== 0.0 ) Vec3.mult( d, 1.0 / d[ 0 ], this._dinvX );
            if ( d[ 1 ] !== 0.0 ) Vec3.mult( d, 1.0 / d[ 1 ], this._dinvY );
            if ( d[ 2 ] !== 0.0 ) Vec3.mult( d, 1.0 / d[ 2 ], this._dinvZ );

            this._intersector.hits = intersections;
            this._intersector.setNodePath( nodePath );
            this._intersector.set( start, end );
        },
        // Classic ray intersection test
        // If it's a leaf it does ray-triangles intersection with the triangles in the cell
        // If it's not a leaf, it descend in the tree in a recursive way as long as the ray
        // intersects the boundinbox of the nodes
        intersect: ( function() {

            var v0 = [ 0.0, 0.0, 0.0 ];
            var v1 = [ 0.0, 0.0, 0.0 ];
            var v2 = [ 0.0, 0.0, 0.0 ];

            return function( node, ls, le ) {
                var first = node._first;
                var second = node._second;
                var triangles = this._triangles;
                var vertices = this._vertices;

                if ( first < 0 ) {
                    // treat as a leaf
                    var istart = -first - 1;
                    var iend = istart + second;
                    var intersector = this._intersector;
                    intersector.index = istart;

                    for ( var i = istart; i < iend; ++i ) {
                        var id = i * 3;
                        var iv0 = triangles[ id ] * 3;
                        var iv1 = triangles[ id + 1 ] * 3;
                        var iv2 = triangles[ id + 2 ] * 3;

                        v0[ 0 ] = vertices[ iv0 ];
                        v0[ 1 ] = vertices[ iv0 + 1 ];
                        v0[ 2 ] = vertices[ iv0 + 2 ];

                        v1[ 0 ] = vertices[ iv1 ];
                        v1[ 1 ] = vertices[ iv1 + 1 ];
                        v1[ 2 ] = vertices[ iv1 + 2 ];

                        v2[ 0 ] = vertices[ iv2 ];
                        v2[ 1 ] = vertices[ iv2 + 1 ];
                        v2[ 2 ] = vertices[ iv2 + 2 ];

                        intersector.intersect( v0, v1, v2 );
                    }
                } else {
                    var s = node._nodeRayStart;
                    var e = node._nodeRayEnd;
                    Vec3.copy( ls, s );
                    Vec3.copy( le, e );
                    if ( first > 0 ) {
                        if ( this.intersectAndClip( s, e, this._kdNodes[ first ]._bb ) ) {
                            this.intersect( this._kdNodes[ first ], s, e );
                        }
                    }
                    if ( second > 0 ) {
                        Vec3.copy( ls, s );
                        Vec3.copy( le, e );
                        if ( this.intersectAndClip( s, e, this._kdNodes[ second ]._bb ) ) {
                            this.intersect( this._kdNodes[ second ], s, e );
                        }
                    }
                }
            };
        } )(),
        // This method do 2 things
        // It test if the ray intersects the node
        // If so... it clip the ray so that the start and end point of the ray are
        // snapped to the bounding box of the nodes
        intersectAndClip: ( function() {
            var tmp = [ 0.0, 0.0, 0.0 ];
            return function( s, e, bb ) {
                var min = bb._min;
                var xmin = min[ 0 ];
                var ymin = min[ 1 ];
                var zmin = min[ 2 ];

                var max = bb._max;
                var xmax = max[ 0 ];
                var ymax = max[ 1 ];
                var zmax = max[ 2 ];

                var invX = this._dinvX;
                var invY = this._dinvY;
                var invZ = this._dinvZ;

                if ( s[ 0 ] <= e[ 0 ] ) {
                    // trivial reject of segment wholely outside.
                    if ( e[ 0 ] < xmin ) return false;
                    if ( s[ 0 ] > xmax ) return false;

                    if ( s[ 0 ] < xmin ) {
                        // clip s to xMin.
                        Vec3.mult( invX, xmin - s[ 0 ], tmp );
                        Vec3.add( s, tmp, s );
                    }

                    if ( e[ 0 ] > xmax ) {
                        // clip e to xMax.
                        Vec3.mult( invX, xmax - s[ 0 ], tmp );
                        Vec3.add( s, tmp, e );
                    }
                } else {
                    if ( s[ 0 ] < xmin ) return false;
                    if ( e[ 0 ] > xmax ) return false;

                    if ( e[ 0 ] < xmin ) {
                        // clip s to xMin.
                        Vec3.mult( invX, xmin - s[ 0 ], tmp );
                        Vec3.add( s, tmp, e );
                    }

                    if ( s[ 0 ] > xmax ) {
                        // clip e to xMax.
                        Vec3.mult( invX, xmax - s[ 0 ], tmp );
                        Vec3.add( s, tmp, s );
                    }
                }

                // compate s and e against the yMin to yMax range of bb.
                if ( s[ 1 ] <= e[ 1 ] ) {

                    // trivial reject of segment wholely outside.
                    if ( e[ 1 ] < ymin ) return false;
                    if ( s[ 1 ] > ymax ) return false;

                    if ( s[ 1 ] < ymin ) {
                        // clip s to yMin.
                        Vec3.mult( invY, ymin - s[ 1 ], tmp );
                        Vec3.add( s, tmp, s );
                    }

                    if ( e[ 1 ] > ymax ) {
                        // clip e to yMax.
                        Vec3.mult( invY, ymax - s[ 1 ], tmp );
                        Vec3.add( s, tmp, e );
                    }
                } else {
                    if ( s[ 1 ] < ymin ) return false;
                    if ( e[ 1 ] > ymax ) return false;

                    if ( e[ 1 ] < ymin ) {
                        // clip s to yMin.
                        Vec3.mult( invY, ymin - s[ 1 ], tmp );
                        Vec3.add( s, tmp, e );
                    }

                    if ( s[ 1 ] > ymax ) {
                        // clip e to yMax.
                        Vec3.mult( invY, ymax - s[ 1 ], tmp );
                        Vec3.add( s, tmp, s );
                    }
                }

                // compate s and e against the zMin to zMax range of bb.
                if ( s[ 2 ] <= e[ 2 ] ) {
                    // trivial reject of segment wholely outside.
                    if ( e[ 2 ] < zmin ) return false;
                    if ( s[ 2 ] > zmax ) return false;

                    if ( s[ 2 ] < zmin ) {
                        // clip s to zMin.
                        Vec3.mult( invZ, zmin - s[ 2 ], tmp );
                        Vec3.add( s, tmp, s );
                    }

                    if ( e[ 2 ] > zmax ) {
                        // clip e to zMax.
                        Vec3.mult( invZ, zmax - s[ 2 ], tmp );
                        Vec3.add( s, tmp, e );
                    }
                } else {
                    if ( s[ 2 ] < zmin ) return false;
                    if ( e[ 2 ] > zmax ) return false;

                    if ( e[ 2 ] < zmin ) {
                        // clip s to zMin.
                        Vec3.mult( invZ, zmin - s[ 2 ], tmp );
                        Vec3.add( s, tmp, e );
                    }

                    if ( s[ 2 ] > zmax ) {
                        // clip e to zMax.
                        Vec3.mult( invZ, zmax - s[ 2 ], tmp );
                        Vec3.add( s, tmp, s );
                    }
                }
                return true;
            };
        } )()
    };

    var BuildKdTree = function( kdTree ) {
        this._kdTree = kdTree;
        this._bb = new BoundingBox();
        this._primitiveIndices = null; // Uint32Array
        this._centers = null; // Float32Array
        this._axisOrder = [ 0, 0, 0 ];
        this._stackLength = 0;
    };

    BuildKdTree.prototype = {
        build: function( options, geom ) {
            var targetTris = options._targetNumTrianglesPerLeaf;
            var vertexAttrib = geom.getVertexAttributeList().Vertex;
            if ( !vertexAttrib )
                return false;
            var vertices = vertexAttrib.getElements();
            if ( !vertices )
                return false;
            var nbVertices = vertices.length / 3;
            if ( nbVertices < targetTris )
                return false;

            this._bb.copy( geom.getBoundingBox() );
            this._kdTree.setVertices( vertices );

            this.computeDivisions( options );
            options._numVerticesProcessed += nbVertices;

            this.computeTriangles( geom );

            var node = new KdNode( -1, this._primitiveIndices.length );
            node._bb.copy( this._bb );
            var nodeNum = this._kdTree.addNode( node );

            var bb = new BoundingBox();
            bb.copy( this._bb );
            nodeNum = this.divide( options, bb, nodeNum, 0 );

            // Here we re-order the triangle list so that we can have a flat tree
            // _primitiveIndices is the ordered array of the triangle indices
            var triangles = this._kdTree.getTriangles();
            var primitives = this._primitiveIndices;
            var nbPrimitives = primitives.length;
            var triangleOrdered = new MACROUTILS.Uint32Array( triangles.length );
            for ( var i = 0, j = 0; i < nbPrimitives; ++i, j += 3 ) {
                var id = primitives[ i ] * 3;
                triangleOrdered[ j ] = triangles[ id ];
                triangleOrdered[ j + 1 ] = triangles[ id + 1 ];
                triangleOrdered[ j + 2 ] = triangles[ id + 2 ];
            }
            this._kdTree.setTriangles( triangleOrdered );

            return this._kdTree.getNodes().length > 0;
        },
        // The function first gather all the triangles of the geometry
        // It then computes the centroid for each triangle and initialize
        // of triangles indices that will refer to the main triangles array
        computeTriangles: function( geom ) {
            var kdTree = this._kdTree;

            var totalLenArray = 0;
            var geomPrimitives = geom.primitives;
            var nbPrimitives = geomPrimitives.length;
            var i = 0;
            for ( i = 0; i < nbPrimitives; i++ ) {
                var prim = geomPrimitives[ i ];
                var mode = prim.getMode();
                if ( mode === PrimitiveSet.TRIANGLES )
                    totalLenArray += prim.getCount();
                else
                    totalLenArray += ( prim.getCount() - 2 ) * 3;
            }
            var indices = new MACROUTILS.Uint32Array( totalLenArray );
            var next = 0;
            var cb = function( i1, i2, i3 ) {
                if ( i1 === i2 || i1 === i3 || i2 === i3 )
                    return;
                indices[ next ] = i1;
                indices[ next + 1 ] = i2;
                indices[ next + 2 ] = i3;
                next += 3;
            };

            var tif = new TriangleIndexFunctor( geom, cb );
            tif.apply();
            indices = indices.subarray( 0, next );

            var nbTriangles = indices.length;
            kdTree.setTriangles( indices );

            var vertices = kdTree.getVertices();

            this._centers = new MACROUTILS.Float32Array( nbTriangles );
            var centers = this._centers;
            this._primitiveIndices = new MACROUTILS.Uint32Array( nbTriangles / 3 );
            var primitives = this._primitiveIndices;

            var j = 0;
            for ( i = 0, j = 0; i < nbTriangles; i += 3, ++j ) {
                var iv0 = indices[ i ];
                var iv1 = indices[ i + 1 ];
                var iv2 = indices[ i + 2 ];

                // discard degenerate points
                if ( iv0 === iv1 || iv1 === iv2 || iv0 === iv2 )
                    return;

                iv0 *= 3;
                iv1 *= 3;
                iv2 *= 3;

                var v0x = vertices[ iv0 ];
                var v0y = vertices[ iv0 + 1 ];
                var v0z = vertices[ iv0 + 2 ];

                var v1x = vertices[ iv1 ];
                var v1y = vertices[ iv1 + 1 ];
                var v1z = vertices[ iv1 + 2 ];

                var v2x = vertices[ iv2 ];
                var v2y = vertices[ iv2 + 1 ];
                var v2z = vertices[ iv2 + 2 ];

                var minx = Math.min( v0x, Math.min( v1x, v2x ) );
                var miny = Math.min( v0y, Math.min( v1y, v2y ) );
                var minz = Math.min( v0z, Math.min( v1z, v2z ) );

                var maxx = Math.max( v0x, Math.max( v1x, v2x ) );
                var maxy = Math.max( v0y, Math.max( v1y, v2y ) );
                var maxz = Math.max( v0z, Math.max( v1z, v2z ) );
                centers[ i ] = ( minx + maxx ) * 0.5;
                centers[ i + 1 ] = ( miny + maxy ) * 0.5;
                centers[ i + 2 ] = ( minz + maxz ) * 0.5;
                primitives[ j ] = j;
            }
        },
        computeDivisions: function( options ) {
            this._stackLength = options._maxNumLevels;
            var max = this._bb._max;
            var min = this._bb._min;
            var dx = max[ 0 ] - min[ 0 ];
            var dy = max[ 1 ] - min[ 1 ];
            var dz = max[ 2 ] - min[ 2 ];
            var axisOrder = this._axisOrder;

            // We set the cutting order (longest edge aabb first)
            axisOrder[ 0 ] = ( dx >= dy && dx >= dz ) ? 0 : ( dy >= dz ) ? 1 : 2;
            axisOrder[ 2 ] = ( dx < dy && dx < dz ) ? 0 : ( dy < dz ) ? 1 : 2;
            var sum = axisOrder[ 0 ] + axisOrder[ 2 ];
            axisOrder[ 1 ] = sum === 3 ? 0 : sum === 2 ? 1 : 2;
        },
        // The core function of the kdtree building
        // It checks if the node need to be subdivide or not
        // If it decides it's a leaf, it computes the final bounding box of the node
        // and it ends here
        // If it's a node, then it puts the splitting axis position on the median population
        // On the same time it reorder the triangle index array
        divide: function( options, bb, nodeIndex, level ) {
            var kdTree = this._kdTree;
            var primitives = this._primitiveIndices;
            var nodes = kdTree.getNodes();
            var node = nodes[ nodeIndex ];

            var first = node._first;
            var second = node._second;

            var needToDivide = level < this._stackLength && first < 0 && second > options._targetNumTrianglesPerLeaf;
            var istart = -first - 1;
            var iend = istart + second - 1;

            if ( !needToDivide ) {
                if ( first < 0 ) {
                    // leaf is done, now compute bound on it.
                    this.computeNodeBox( node, istart, iend );
                }
                return nodeIndex;
            }

            if ( first >= 0 )
                return nodeIndex;
            // leaf node as first < 0, so look at dividing it.

            var axis = this._axisOrder[ level % 3 ];
            var originalMin = bb._min[ axis ];
            var originalMax = bb._max[ axis ];

            var mid = ( originalMin + originalMax ) * 0.5;

            var originalLeftChildIndex = 0;
            var originalRightChildIndex = 0;
            var insitueDivision = false;

            var left = istart;
            var right = iend;

            var centers = this._centers;
            while ( left < right ) {
                while ( left < right && ( centers[ primitives[ left ] * 3 + axis ] <= mid ) ) {
                    ++left;
                }

                while ( left < right && ( centers[ primitives[ right ] * 3 + axis ] > mid ) ) {
                    --right;
                }

                if ( left < right ) {
                    var tmp = primitives[ left ];
                    primitives[ left ] = primitives[ right ];
                    primitives[ right ] = tmp;
                    ++left;
                    --right;
                }
            }

            if ( left === right ) {
                if ( centers[ primitives[ left ] * 3 + axis ] <= mid )++left;
                else --right;
            }

            if ( ( right - istart ) <= -1 ) {
                originalLeftChildIndex = 0;
                originalRightChildIndex = nodeIndex;
                insitueDivision = true;
            } else if ( ( iend - left ) <= -1 ) {
                originalLeftChildIndex = nodeIndex;
                originalRightChildIndex = 0;
                insitueDivision = true;
            } else {
                originalLeftChildIndex = kdTree.addNode( new KdNode( -istart - 1, ( right - istart ) + 1 ) );
                originalRightChildIndex = kdTree.addNode( new KdNode( -left - 1, ( iend - left ) + 1 ) );
            }


            var restore = bb._max[ axis ];
            bb._max[ axis ] = mid;

            var leftChildIndex = originalLeftChildIndex !== 0 ? this.divide( options, bb, originalLeftChildIndex, level + 1 ) : 0;

            bb._max[ axis ] = restore;

            restore = bb._min[ axis ];
            bb._min[ axis ] = mid;

            var rightChildIndex = originalRightChildIndex !== 0 ? this.divide( options, bb, originalRightChildIndex, level + 1 ) : 0;

            bb._min[ axis ] = restore;

            if ( !insitueDivision ) {
                node._first = leftChildIndex;
                node._second = rightChildIndex;

                insitueDivision = true;

                var bnode = node._bb;
                bnode.init();
                if ( leftChildIndex !== 0 ) bnode.expandByBoundingBox( nodes[ leftChildIndex ]._bb );
                if ( rightChildIndex !== 0 ) bnode.expandByBoundingBox( nodes[ rightChildIndex ]._bb );
            }
            return nodeIndex;
        },
        // It computes the bounding box of the node so that the box contains all the triangles
        // of the cell
        computeNodeBox: function( node, istart, iend ) {
            var minx = Infinity,
                miny = Infinity,
                minz = Infinity,
                maxx = -Infinity,
                maxy = -Infinity,
                maxz = -Infinity;
            var triangles = this._kdTree.getTriangles();
            var vertices = this._kdTree.getVertices();
            var primitives = this._primitiveIndices;
            for ( var i = istart; i <= iend; ++i ) {
                var id = primitives[ i ] * 3;
                var iv0 = triangles[ id ] * 3;
                var iv1 = triangles[ id + 1 ] * 3;
                var iv2 = triangles[ id + 2 ] * 3;

                var v0x = vertices[ iv0 ];
                var v0y = vertices[ iv0 + 1 ];
                var v0z = vertices[ iv0 + 2 ];

                var v1x = vertices[ iv1 ];
                var v1y = vertices[ iv1 + 1 ];
                var v1z = vertices[ iv1 + 2 ];

                var v2x = vertices[ iv2 ];
                var v2y = vertices[ iv2 + 1 ];
                var v2z = vertices[ iv2 + 2 ];

                minx = Math.min( minx, Math.min( v0x, Math.min( v1x, v2x ) ) );
                miny = Math.min( miny, Math.min( v0y, Math.min( v1y, v2y ) ) );
                minz = Math.min( minz, Math.min( v0z, Math.min( v1z, v2z ) ) );

                maxx = Math.max( maxx, Math.max( v0x, Math.max( v1x, v2x ) ) );
                maxy = Math.max( maxy, Math.max( v0y, Math.max( v1y, v2y ) ) );
                maxz = Math.max( maxz, Math.max( v0z, Math.max( v1z, v2z ) ) );
            }
            var epsilon = 1E-6;
            var bnode = node._bb;
            var bmin = bnode._min;
            var bmax = bnode._max;
            bmin[ 0 ] = minx - epsilon;
            bmin[ 1 ] = miny - epsilon;
            bmin[ 2 ] = minz - epsilon;
            bmax[ 0 ] = maxx + epsilon;
            bmax[ 1 ] = maxy + epsilon;
            bmax[ 2 ] = maxz + epsilon;
        }
    };

    var KdTree = function() {
        this._vertices = null;
        this._kdNodes = [];
        this._triangles = null; // Float32Array
    };

    KdTree.prototype = MACROUTILS.objectLibraryClass( {
        getVertices: function() {
            return this._vertices;
        },
        setVertices: function( vertices ) {
            this._vertices = vertices;
        },
        getNodes: function() {
            return this._kdNodes;
        },
        getTriangles: function() {
            return this._triangles;
        },
        setTriangles: function( triangles ) {
            this._triangles = triangles;
        },
        addNode: function( node ) {
            this._kdNodes.push( node );
            return this._kdNodes.length - 1;
        },
        build: function( options, geom ) {
            var buildTree = new BuildKdTree( this );
            return buildTree.build( options, geom );
        },
        intersect: function( start, end, intersections, nodePath ) {
            if ( this._kdNodes.length === 0 ) {
                return false;
            }

            var numIntersectionsBefore = intersections.length;
            var intersector = new IntersectKdTree( this._vertices, this._kdNodes, this._triangles, intersections, start, end, nodePath );
            intersector.intersect( this.getNodes()[ 0 ], start, end );

            return numIntersectionsBefore !== intersections.length;
        }
    }, 'osg', 'KdTree' );

    return KdTree;
} );
define( 'osg/KdTreeBuilder',[
    'osg/Utils',
    'osg/NodeVisitor',
    'osg/KdTree'
], function ( MACROUTILS, NodeVisitor, KdTree ) {

    var KdTreeBuilder = function ( options ) {
        NodeVisitor.call( this );
        this._buildOptions = options !== undefined ? options : {
            _numVerticesProcessed: 0,
            _targetNumTrianglesPerLeaf: 50,
            _maxNumLevels: 20
        };
    };

    KdTreeBuilder.prototype = MACROUTILS.objectInehrit( NodeVisitor.prototype, {
        apply: function ( node ) {
            if ( node.getShape ) {
                var shape = node.getShape();
                if ( shape === null ) { // we test if the kdTree is already built
                    var kdTree = new KdTree();
                    if ( kdTree.build( this._buildOptions, node ) ) {
                        node.setShape( kdTree );
                    }
                }
            }
            this.traverse( node );
        }
    } );

    return KdTreeBuilder;
} );
define( 'osg/Uniform',[
    'osg/Utils'
], function ( MACROUTILS ) {
        /**
     * Uniform manage variable used in glsl shader.
     * @class Uniform
     */
    var Uniform = function () {
        this.transpose = false;
        this._dirty = true;
        this.name = '';
        this.type = undefined;
    };

    Uniform.isUniform = function ( obj ) {
        if ( obj.prototype === Uniform.prototype ) {
            return true;
        }
        return false;
    };

    /** @lends Uniform.prototype */
    Uniform.prototype = {
        getName: function () {
            return this.name;
        },
        getType: function () {
            return this.type;
        },

        get: function () { // call dirty if you update this array outside
            return this.data;
        },
        set: function ( array ) {
            this.data = array;
            this.dirty();
        },
        dirty: function () {
            this._dirty = true;
        },
        apply: function ( gl, location ) {
            if ( this._dirty ) {
                this.update.call( this.glData, this.data );
                this._dirty = false;
            }
            this.glCall( gl, location, this.glData );
        },
        applyMatrix: function ( gl, location ) {
            if ( this._dirty ) {
                this.update.call( this.glData, this.data );
                this._dirty = false;
            }
            this.glCall( gl, location, this.transpose, this.glData );
        },
        update: function ( array ) {
            for ( var i = 0, l = array.length; i < l; ++i ) { // FF not traced maybe short
                this[ i ] = array[ i ];
            }
        },

        _updateArray: function ( array ) {
            for ( var i = 0, l = array.length; i < l; ++i ) { // FF not traced maybe short
                this[ i ] = array[ i ];
            }
        },

        _updateFloat1: function ( f ) {
            this[ 0 ] = f[ 0 ];
        },
        _updateFloat2: function ( f ) {
            this[ 0 ] = f[ 0 ];
            this[ 1 ] = f[ 1 ];
        },
        _updateFloat3: function ( f ) {
            this[ 0 ] = f[ 0 ];
            this[ 1 ] = f[ 1 ];
            this[ 2 ] = f[ 2 ];
        },
        _updateFloat4: function ( f ) {
            this[ 0 ] = f[ 0 ];
            this[ 1 ] = f[ 1 ];
            this[ 2 ] = f[ 2 ];
            this[ 3 ] = f[ 3 ];
        },
        _updateFloat9: function ( f ) {
            this[ 0 ] = f[ 0 ];
            this[ 1 ] = f[ 1 ];
            this[ 2 ] = f[ 2 ];
            this[ 3 ] = f[ 3 ];
            this[ 4 ] = f[ 4 ];
            this[ 5 ] = f[ 5 ];
            this[ 6 ] = f[ 6 ];
            this[ 7 ] = f[ 7 ];
            this[ 8 ] = f[ 8 ];
        },
        _updateFloat16: function ( f ) {
            this[ 0 ] = f[ 0 ];
            this[ 1 ] = f[ 1 ];
            this[ 2 ] = f[ 2 ];
            this[ 3 ] = f[ 3 ];
            this[ 4 ] = f[ 4 ];
            this[ 5 ] = f[ 5 ];
            this[ 6 ] = f[ 6 ];
            this[ 7 ] = f[ 7 ];
            this[ 8 ] = f[ 8 ];
            this[ 9 ] = f[ 9 ];
            this[ 10 ] = f[ 10 ];
            this[ 11 ] = f[ 11 ];
            this[ 12 ] = f[ 12 ];
            this[ 13 ] = f[ 13 ];
            this[ 14 ] = f[ 14 ];
            this[ 15 ] = f[ 15 ];
        }
    };

    Uniform.createFloat1 = function ( data, uniformName ) {
        var value = data;
        var name = uniformName;
        if ( name === undefined ) {
            name = value;
            value = [ 0 ];
        }
        var uniform = new Uniform();
        uniform.data = [ value ];
        uniform.glCall = function ( gl, location, glData ) {
            gl.uniform1fv( location, glData );
        };
        uniform.glData = new MACROUTILS.Float32Array( uniform.data );
        uniform.update = Uniform.prototype._updateFloat1;
        uniform.set = function ( value ) {
            if ( typeof value === 'number' ) {
                this.data[ 0 ] = value;
            } else {
                this.data = value;
            }
            this.dirty();
        };

        uniform.name = name;
        uniform.type = 'float';
        return uniform;
    };
    Uniform.createFloat = Uniform.createFloat1;
    Uniform[ 'float' ] = Uniform.createFloat1;
    Uniform.createFloatArray = function ( array, name ) {
        var u = Uniform.createFloat.call( this, array, name );
        u.update = Uniform.prototype._updateArray;
        return u;
    };

    Uniform.createFloat2 = function ( data, uniformName ) {
        var value = data;
        var name = uniformName;
        if ( name === undefined ) {
            name = value;
            value = [ 0, 0 ];
        }
        var uniform = new Uniform();
        uniform.data = value;
        uniform.glCall = function ( gl, location, glData ) {
            gl.uniform2fv( location, glData );
        };
        uniform.glData = new MACROUTILS.Float32Array( uniform.data );
        uniform.update = Uniform.prototype._updateFloat2;
        uniform.name = name;
        uniform.type = 'vec2';
        return uniform;
    };
    Uniform.vec2 = Uniform.createFloat2;
    Uniform.createFloat2Array = function ( array, name ) {
        var u = Uniform.createFloat2.call( this, array, name );
        u.update = Uniform.prototype._updateArray;
        return u;
    };

    Uniform.createFloat3 = function ( data, uniformName ) {
        var value = data;
        var name = uniformName;
        if ( name === undefined ) {
            name = value;
            value = [ 0, 0, 0 ];
        }
        var uniform = new Uniform();
        uniform.data = value;
        uniform.glCall = function ( gl, location, glData ) {
            gl.uniform3fv( location, glData );
        };
        uniform.glData = new MACROUTILS.Float32Array( uniform.data );
        uniform.update = Uniform.prototype._updateFloat3;
        uniform.name = name;
        uniform.type = 'vec3';
        return uniform;
    };
    Uniform.vec3 = Uniform.createFloat3;
    Uniform.createFloat3Array = function ( array, name ) {
        var u = Uniform.createFloat3.call( this, array, name );
        u.update = Uniform.prototype._updateArray;
        return u;
    };

    Uniform.createFloat4 = function ( data, uniformName ) {
        var value = data;
        var name = uniformName;
        if ( name === undefined ) {
            name = value;
            value = [ 0, 0, 0, 0 ];
        }
        var uniform = new Uniform();
        uniform.data = value;
        uniform.glCall = function ( gl, location, glData ) {
            gl.uniform4fv( location, glData );
        };
        uniform.glData = new MACROUTILS.Float32Array( uniform.data );
        uniform.update = Uniform.prototype._updateFloat4;
        uniform.name = name;
        uniform.type = 'vec4';
        return uniform;
    };
    Uniform.vec4 = Uniform.createFloat4;
    Uniform.createFloat4Array = function ( array, name ) {
        var u = Uniform.createFloat4.call( this, array, name );
        u.update = Uniform.prototype._updateArray;
        return u;
    };

    Uniform.createInt1 = function ( data, uniformName ) {
        var value = data;
        var name = uniformName;
        if ( name === undefined ) {
            name = value;
            value = [ 0 ];
        }
        var uniform = new Uniform();
        uniform.data = [ value ];
        uniform.glCall = function ( gl, location, glData ) {
            gl.uniform1iv( location, glData );
        };
        uniform.set = function ( value ) {
            if ( typeof value === 'number' ) {
                this.data[ 0 ] = value;
            } else {
                this.data = value;
            }
            this.dirty();
        };

        uniform.glData = new MACROUTILS.Int32Array( uniform.data );
        uniform.name = name;
        uniform.type = 'int';
        return uniform;
    };
    Uniform[ 'int' ] = Uniform.createInt1;
    Uniform.createInt = Uniform.createInt1;
    Uniform.createIntArray = function ( array, name ) {
        var u = Uniform.createInt.call( this, array, name );
        u.update = Uniform.prototype._updateArray;
        return u;
    };


    Uniform.createInt2 = function ( data, uniformName ) {
        var value = data;
        var name = uniformName;
        if ( name === undefined ) {
            name = value;
            value = [ 0, 0 ];
        }
        var uniform = new Uniform();
        uniform.data = value;
        uniform.glCall = function ( gl, location, glData ) {
            gl.uniform2iv( location, glData );
        };
        uniform.glData = new MACROUTILS.Int32Array( uniform.data );
        uniform.name = name;
        uniform.type = 'vec2i';
        return uniform;
    };
    Uniform.vec2i = Uniform.createInt2;
    Uniform.createInt2Array = function ( array, name ) {
        var u = Uniform.createInt2.call( this, array, name );
        u.update = Uniform.prototype._updateArray;
        return u;
    };

    Uniform.createInt3 = function ( data, uniformName ) {
        var value = data;
        var name = uniformName;
        if ( name === undefined ) {
            name = value;
            value = [ 0, 0, 0 ];
        }
        var uniform = new Uniform();
        uniform.data = value;
        uniform.glCall = function ( gl, location, glData ) {
            gl.uniform3iv( location, glData );
        };
        uniform.glData = new MACROUTILS.Int32Array( uniform.data );
        uniform.name = name;
        uniform.type = 'vec3i';
        return uniform;
    };
    Uniform.vec3i = Uniform.createInt3;
    Uniform.createInt3Array = function ( array, name ) {
        var u = Uniform.createInt3.call( this, array, name );
        u.update = Uniform.prototype._updateArray;
        return u;
    };

    Uniform.createInt4 = function ( data, uniformName ) {
        var value = data;
        var name = uniformName;
        if ( name === undefined ) {
            name = value;
            value = [ 0, 0, 0, 0 ];
        }
        var uniform = new Uniform();
        uniform.data = value;
        uniform.glCall = function ( gl, location, glData ) {
            gl.uniform4iv( location, glData );
        };
        uniform.glData = new MACROUTILS.Int32Array( uniform.data );
        uniform.name = name;
        uniform.type = 'vec4i';
        return uniform;
    };
    Uniform.vec4i = Uniform.createInt4;

    Uniform.createInt4Array = function ( array, name ) {
        var u = Uniform.createInt4.call( this, array, name );
        u.update = Uniform.prototype._updateArray;
        return u;
    };

    Uniform.createMatrix2 = function ( data, uniformName ) {
        var value = data;
        var name = uniformName;
        if ( name === undefined ) {
            name = value;
            value = [ 1, 0, 0, 1 ];
        }
        var uniform = new Uniform();
        uniform.data = value;
        uniform.glCall = function ( gl, location, transpose, glData ) {
            gl.uniformMatrix2fv( location, transpose, glData );
        };
        uniform.apply = uniform.applyMatrix;
        uniform.transpose = false;
        uniform.glData = new MACROUTILS.Float32Array( uniform.data );
        uniform.update = Uniform.prototype._updateFloat4;
        uniform.name = name;
        uniform.type = 'mat2';
        return uniform;
    };
    Uniform.createMat2 = Uniform.createMatrix2;
    Uniform.mat2 = Uniform.createMat2;

    Uniform.createMatrix3 = function ( data, uniformName ) {
        var value = data;
        var name = uniformName;
        if ( name === undefined ) {
            name = value;
            value = [ 1, 0, 0, 0, 1, 0, 0, 0, 1 ];
        }
        var uniform = new Uniform();
        uniform.data = value;
        uniform.glCall = function ( gl, location, transpose, glData ) {
            gl.uniformMatrix3fv( location, transpose, glData );
        };
        uniform.apply = uniform.applyMatrix;
        uniform.transpose = false;
        uniform.glData = new MACROUTILS.Float32Array( uniform.data );
        uniform.update = Uniform.prototype._updateFloat9;
        uniform.name = name;
        uniform.type = 'mat3';
        return uniform;
    };
    Uniform.createMat3 = Uniform.createMatrix3;
    Uniform.mat3 = Uniform.createMatrix3;

    Uniform.createMatrix4 = function ( data, uniformName ) {
        var value = data;
        var name = uniformName;
        if ( name === undefined ) {
            name = value;
            value = [ 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 ];
        }
        var uniform = new Uniform();
        uniform.data = value;
        uniform.glCall = function ( gl, location, transpose, glData ) {
            gl.uniformMatrix4fv( location, transpose, glData );
        };
        uniform.apply = uniform.applyMatrix;
        uniform.transpose = false;
        uniform.glData = new MACROUTILS.Float32Array( uniform.data );
        uniform.update = Uniform.prototype._updateFloat16;
        uniform.name = name;
        uniform.type = 'mat4';
        return uniform;
    };
    Uniform.createMat4 = Uniform.createMatrix4;
    Uniform.mat4 = Uniform.createMatrix4;

    return Uniform;
} );

define( 'osg/Program',[
    'osg/Utils',
    'osg/Notify',
    'osg/StateAttribute',
    'osg/Map'
], function ( MACROUTILS, Notify, StateAttribute, Map ) {

    /**
     * Program encapsulate an vertex and fragment shader
     * @class Program
     */
    var Program = function ( vShader, fShader ) {
        StateAttribute.call( this );

        this.program = null;
        this.setVertexShader( vShader );
        this.setFragmentShader( fShader );
        this.dirty = true;
    };

    /** @lends Program.prototype */
    Program.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( StateAttribute.prototype, {

        attributeType: 'Program',
        cloneType: function () {
            var p = new Program();
            p.defaultProgram = true;
            return p;
        },
        getType: function () {
            return this.attributeType;
        },
        getTypeMember: function () {
            return this.attributeType;
        },
        setVertexShader: function ( vs ) {
            this.vertex = vs;
        },
        setFragmentShader: function ( fs ) {
            this.fragment = fs;
        },
        getVertexShader: function () {
            return this.vertex;
        },
        getFragmentShader: function () {
            return this.fragment;
        },
        apply: function ( state ) {
            var gl = state.getGraphicContext();
            if ( !this.program || this.isDirty() ) {

                if ( this.defaultProgram === true ) {
                    return;
                }

                if ( !this.vertex.shader ) {
                    this.vertex.compile( gl );
                }
                if ( !this.fragment.shader ) {
                    this.fragment.compile( gl );
                }
                this.program = gl.createProgram();
                gl.attachShader( this.program, this.vertex.shader );
                gl.attachShader( this.program, this.fragment.shader );
                MACROUTILS.timeStamp( 'osgjs.metrics:linkShader' );
                gl.linkProgram( this.program );
                gl.validateProgram( this.program );
                if ( !gl.getProgramParameter( this.program, gl.LINK_STATUS ) && !gl.isContextLost() ) {
                    Notify.log( 'can\'t link program\n' + 'vertex shader:\n' + this.vertex.text + '\n fragment shader:\n' + this.fragment.text );
                    Notify.log( gl.getProgramInfoLog( this.program ) );
                    this.setDirty( false );
                    //debugger;
                    return;
                }

                this.uniformsCache = new Map();
                this.attributesCache = new Map();

                this.cacheUniformList( gl, this.vertex.text );
                this.cacheUniformList( gl, this.fragment.text );

                this.cacheAttributeList( gl, this.vertex.text );

                this.setDirty( false );
            }

            gl.useProgram( this.program );
        },

        cacheUniformList: function ( gl, str ) {
            var r = str.match( /uniform\s+\w+\s+\w+/g );
            var map = this.uniformsCache.getMapContent();
            if ( r !== null ) {
                for ( var i = 0, l = r.length; i < l; i++ ) {
                    var uniform = r[ i ].match( /uniform\s+\w+\s+(\w+)/ )[ 1 ];
                    var location = gl.getUniformLocation( this.program, uniform );
                    if ( location !== undefined && location !== null ) {
                        if ( map[ uniform ] === undefined ) {
                            map[ uniform ] = location;
                            this.uniformsCache.dirty();
                        }
                    }
                }
            }
        },

        cacheAttributeList: function ( gl, str ) {
            var r = str.match( /attribute\s+\w+\s+\w+/g );
            var map = this.attributesCache.getMapContent();
            if ( r !== null ) {
                for ( var i = 0, l = r.length; i < l; i++ ) {
                    var attr = r[ i ].match( /attribute\s+\w+\s+(\w+)/ )[ 1 ];
                    var location = gl.getAttribLocation( this.program, attr );
                    if ( location !== -1 && location !== undefined ) {
                        if ( map[ attr ] === undefined ) {
                            map[ attr ] = location;
                            this.attributesCache.dirty();
                        }
                    }
                }
            }
        }
    } ), 'osg', 'Program' );

    Program.create = function ( vShader, fShader ) {
        Notify.log( 'Program.create is deprecated use new Program(vertex, fragment) instead' );
        var program = new Program( vShader, fShader );
        return program;
    };

    return Program;
} );

define( 'osg/Shader',[
    'osg/Notify',
    'osg/Utils'
], function ( Notify, Utils ) {

    /**
     * Shader manage shader for vertex and fragment, you need both to create a glsl program.
     * @class Shader
     */
    var Shader = function ( type, text ) {

        var t = type;
        if ( typeof ( type ) === 'string' ) {
            t = Shader[ type ];
        }
        this.type = t;
        this.setText( text );
    };

    Shader.VERTEX_SHADER = 0x8B31;
    Shader.FRAGMENT_SHADER = 0x8B30;

    /** @lends Shader.prototype */
    Shader.prototype = {
        setText: function ( text ) {
            this.text = text;
        },
        getText: function () {
            return this.text;
        },
        compile: function ( gl ) {
            this.shader = gl.createShader( this.type );
            gl.shaderSource( this.shader, this.text );
            Utils.timeStamp( 'osgjs.metrics:compileShader' );
            gl.compileShader( this.shader );
            if ( !gl.getShaderParameter( this.shader, gl.COMPILE_STATUS ) && !gl.isContextLost() ) {
                Notify.log( 'can\'t compile shader:\n' + this.text + '\n' );
                var tmpText = '\n' + this.text;
                var splittedText = tmpText.split( '\n' );
                var newText = '\n';
                for ( var i = 0, l = splittedText.length; i < l; ++i ) {
                    newText += i + ' ' + splittedText[ i ] + '\n';
                }
                Notify.log( newText );
                Notify.log( gl.getShaderInfoLog( this.shader ) );
            }
        }
    };

    Shader.create = function ( type, text ) {
        Notify.log( 'Shader.create is deprecated, use new Shader with the same arguments instead' );
        return new Shader( type, text );
    };

    return Shader;
} );

define( 'osg/ShaderGenerator',[
    'osg/Notify',
    'osg/Program',
    'osg/Shader',
    'osg/Map'
], function ( Notify, Program, Shader, Map ) {

    var ShaderGenerator = function () {
        this.cache = [];
    };

    ShaderGenerator.Type = {
        VertexInit: 0,
        VertexFunction: 1,
        VertexMain: 2,
        VertexEnd: 3,
        FragmentInit: 5,
        FragmentFunction: 6,
        FragmentMain: 7,
        FragmentEnd: 8
    };

    ShaderGenerator.prototype = {

        getActiveTypeMember: function ( state ) {
            // we should check attribute is active or not
            var types = [];
            var attributeMapKeys = state.attributeMap.getKeys();
            var attributeMapContent = state.attributeMap.getMapContent();
            for ( var j = 0, k = attributeMapKeys.length; j < k; j++ ) {
                var keya = attributeMapKeys[ j ];
                var attributeStack = attributeMapContent[ keya ];
                if ( attributeStack.length === 0 && attributeStack.globalDefault.applyPositionedUniform === undefined ) {
                    continue;
                }
                if ( attributeStack.globalDefault.getOrCreateUniforms !== undefined || attributeStack.globalDefault.writeToShader !== undefined ) {
                    types.push( keya );
                }
            }

            for ( var i = 0, l = state.textureAttributeMapList.length; i < l; i++ ) {
                var attributesForUnit = state.textureAttributeMapList[ i ];
                if ( attributesForUnit === undefined ) {
                    continue;
                }

                var textureAttributeMapKeys = attributesForUnit.getKeys();
                var textureAttributeMapContent = attributesForUnit.getMapContent();

                for ( var h = 0, m = textureAttributeMapKeys.length; h < m; h++ ) {
                    var key = textureAttributeMapKeys[ h ];
                    var textureAttributeStack = textureAttributeMapContent[ key ];
                    if ( textureAttributeStack.length === 0 ) {
                        continue;
                    }
                    if ( textureAttributeStack.globalDefault.getOrCreateUniforms !== undefined || textureAttributeStack.globalDefault.writeToShader !== undefined ) {
                        types.push( key + i );
                    }
                }
            }
            return types;
        },

        getActiveAttributeMapKeys: function ( state ) {
            var keys = [];
            var attributeMapKeys = state.attributeMap.getKeys();
            var attributeMapContent = state.attributeMap.getMapContent();

            for ( var j = 0, k = attributeMapKeys.length; j < k; j++ ) {
                var keya = attributeMapKeys[ j ];
                var attributeStack = attributeMapContent[ keya ];
                if ( attributeStack.length === 0 && attributeStack.globalDefault.applyPositionedUniform === undefined ) {
                    continue;
                }
                if ( attributeStack.globalDefault.getOrCreateUniforms !== undefined || attributeStack.globalDefault.writeToShader !== undefined ) {
                    keys.push( keya );
                }
            }
            return keys;
        },

        getActiveTextureAttributeMapKeys: function ( state ) {
            var textureAttributeKeys = [];
            for ( var i = 0, l = state.textureAttributeMapList.length; i < l; i++ ) {
                var attributesForUnit = state.textureAttributeMapList[ i ];
                if ( attributesForUnit === undefined ) {
                    continue;
                }

                var textureAttributeMapKeys = attributesForUnit.getKeys();
                var textureAttributeMapContent = attributesForUnit.getMapContent();

                textureAttributeKeys[ i ] = [];
                for ( var j = 0, m = textureAttributeMapKeys.length; j < m; j++ ) {
                    var key = textureAttributeMapKeys[ j ];
                    var textureAttributeStack = textureAttributeMapContent[ key ];
                    if ( textureAttributeStack.length === 0 ) {
                        continue;
                    }
                    if ( textureAttributeStack.globalDefault.getOrCreateUniforms !== undefined || textureAttributeStack.globalDefault.writeToShader !== undefined ) {
                        textureAttributeKeys[ i ].push( key );
                    }
                }
            }
            return textureAttributeKeys;
        },

        // getActiveUniforms
        // return the list of uniforms enabled from the State
        // The idea behind this is to generate a shader depending on attributes/uniforms enabled by the user
        getActiveUniforms: function ( state, attributeKeys, textureAttributeKeys ) {
            var uniformMap = new Map();
            var uniformMapContent = uniformMap.getMapContent();

            var attributeMapContent = state.attributeMap.getMapContent();

            for ( var i = 0, l = attributeKeys.length; i < l; i++ ) {
                var key = attributeKeys[ i ];

                if ( attributeMapContent[ key ].globalDefault.getOrCreateUniforms === undefined ) {
                    continue;
                }
                var attributeUniforms = attributeMapContent[ key ].globalDefault.getOrCreateUniforms();

                var attributeUniformKeys = attributeUniforms.getKeys();
                var attributeUniformContent = attributeUniforms.getMapContent();
                for ( var j = 0, m = attributeUniformKeys.length; j < m; j++ ) {
                    var name = attributeUniformKeys[ j ];
                    var uniform = attributeUniformContent[ name ];
                    uniformMapContent[ uniform.name ] = uniform;
                }
            }

            for ( var a = 0, n = textureAttributeKeys.length; a < n; a++ ) {
                var unitAttributekeys = textureAttributeKeys[ a ];
                if ( unitAttributekeys === undefined ) {
                    continue;
                }
                for ( var b = 0, o = unitAttributekeys.length; b < o; b++ ) {
                    var attrName = unitAttributekeys[ b ];
                    //if (state.textureAttributeMapList[a][attrName].globalDefault === undefined) {
                    //debugger;
                    //}
                    var textureAttribute = state.textureAttributeMapList[ a ].getMapContent()[ attrName ].globalDefault;
                    if ( textureAttribute.getOrCreateUniforms === undefined ) {
                        continue;
                    }
                    var texUniformMap = textureAttribute.getOrCreateUniforms( a );
                    var texUniformMapKeys = texUniformMap.getKeys();
                    var texUniformContent = texUniformMap.getMapContent();
                    for ( var t = 0, tl = texUniformMapKeys.length; t < tl; t++ ) {
                        var tname = texUniformMapKeys[ t ];
                        var tuniform = texUniformContent[ tname ];
                        uniformMapContent[ tuniform.name ] = tuniform;
                    }
                }
            }

            uniformMap.dirty();
            return uniformMap;
        },

        getOrCreateProgram: function ( state ) {

            // first get trace of active attribute and texture attributes to check
            // if we already have generated a program for this configuration
            var flattenKeys = this.getActiveTypeMember( state );
            for ( var i = 0, l = this.cache.length; i < l; ++i ) {
                if ( this.compareAttributeMap( flattenKeys, this.cache[ i ].flattenKeys ) === 0 ) {
                    return this.cache[ i ];
                }
            }

            // extract valid attributes keys with more details
            var attributeKeys = this.getActiveAttributeMapKeys( state );
            var textureAttributeKeys = this.getActiveTextureAttributeMapKeys( state );


            var vertexshader = this.getOrCreateVertexShader( state, attributeKeys, textureAttributeKeys );
            var fragmentshader = this.getOrCreateFragmentShader( state, attributeKeys, textureAttributeKeys );
            var program = new Program(
                new Shader( 'VERTEX_SHADER', vertexshader ),
                new Shader( 'FRAGMENT_SHADER', fragmentshader ) );

            program.flattenKeys = flattenKeys;
            program.activeAttributeKeys = attributeKeys;
            program.activeTextureAttributeKeys = textureAttributeKeys;
            program.activeUniforms = this.getActiveUniforms( state, attributeKeys, textureAttributeKeys );
            program.generated = true;

            Notify.debug( program.vertex.text );
            Notify.debug( program.fragment.text );

            this.cache.push( program );
            return program;
        },

        compareAttributeMap: function ( attributeKeys0, attributeKeys1 ) {
            var key;
            for ( var i = 0, l = attributeKeys0.length; i < l; i++ ) {
                key = attributeKeys0[ i ];
                if ( attributeKeys1.indexOf( key ) === -1 ) {
                    return 1;
                }
            }
            if ( attributeKeys1.length !== attributeKeys0.length ) {
                return -1;
            }
            return 0;
        },

        fillTextureShader: function ( attributeMapList, validTextureAttributeKeys, mode ) {
            var shader = '';
            var commonTypeShader = {};

            for ( var i = 0, l = validTextureAttributeKeys.length; i < l; i++ ) {
                var attributeKeys = validTextureAttributeKeys[ i ];
                if ( attributeKeys === undefined ) {
                    continue;
                }
                var attributeMap = attributeMapList[ i ];
                var attributeMapContent = attributeMap.getMapContent();
                for ( var j = 0, m = attributeKeys.length; j < m; j++ ) {
                    var key = attributeKeys[ j ];

                    var element = attributeMapContent[ key ].globalDefault;

                    if ( element.generateShaderCommon !== undefined && commonTypeShader[ key ] === undefined ) {
                        shader += element.generateShaderCommon( i, mode );
                        commonTypeShader[ key ] = true;
                    }

                    if ( element.generateShader ) {
                        shader += element.generateShader( i, mode );
                    }
                }
            }
            return shader;
        },

        fillShader: function ( attributeMap, validAttributeKeys, mode ) {
            var shader = '';
            var commonTypeShader = {};
            var attributeMapContent = attributeMap.getMapContent();
            for ( var j = 0, m = validAttributeKeys.length; j < m; j++ ) {
                var key = validAttributeKeys[ j ];
                var element = attributeMapContent[ key ].globalDefault;
                var type = element.getType();
                if ( element.generateShaderCommon !== undefined && commonTypeShader[ type ] === undefined ) {
                    shader += element.generateShaderCommon( mode );
                    commonTypeShader[ type ] = true;
                }

                if ( element.generateShader ) {
                    shader += element.generateShader( mode );
                }
            }
            return shader;
        },

        getOrCreateVertexShader: function ( state, validAttributeKeys, validTextureAttributeKeys ) {

            var modes = ShaderGenerator.Type;
            var shader = [
                '',
                '#ifdef GL_ES',
                'precision highp float;',
                '#endif',
                'attribute vec3 Vertex;',
                'attribute vec4 Color;',
                'attribute vec3 Normal;',
                'uniform float ArrayColorEnabled;',
                'uniform mat4 ModelViewMatrix;',
                'uniform mat4 ProjectionMatrix;',
                'uniform mat4 NormalMatrix;',
                'varying vec4 VertexColor;',
                ''
            ].join( '\n' );

            shader += this._writeShaderFromMode( state, validAttributeKeys, validTextureAttributeKeys, modes.VertexInit );

            var func = [
                '',
                'vec4 ftransform() {',
                '  return ProjectionMatrix * ModelViewMatrix * vec4(Vertex, 1.0);',
                '}'
            ].join( '\n' );

            shader += func;

            shader += this._writeShaderFromMode( state, validAttributeKeys, validTextureAttributeKeys, modes.VertexFunction );

            var body = [
                '',
                'void main(void) {',
                '  gl_Position = ftransform();',
                '  if (ArrayColorEnabled == 1.0)',
                '    VertexColor = Color;',
                '  else',
                '    VertexColor = vec4(1.0,1.0,1.0,1.0);',
                '  gl_PointSize = 1.0;',
                ''
            ].join( '\n' );

            shader += body;

            shader += this._writeShaderFromMode( state, validAttributeKeys, validTextureAttributeKeys, modes.VertexMain );

            shader += [
                '}',
                ''
            ].join( '\n' );

            return shader;
        },

        _writeShaderFromMode: function ( state, validAttributeKeys, validTextureAttributeKeys, mode ) {
            var str = '';
            str += this.fillTextureShader( state.textureAttributeMapList, validTextureAttributeKeys, mode );
            str += this.fillShader( state.attributeMap, validAttributeKeys, mode );
            return str;
        },

        getOrCreateFragmentShader: function ( state, validAttributeKeys, validTextureAttributeKeys ) {

            var shader = [
                '',
                '#ifdef GL_ES',
                'precision highp float;',
                '#endif',
                'varying vec4 VertexColor;',
                'uniform float ArrayColorEnabled;',
                'vec4 fragColor;',
                ''
            ].join( '\n' );

            var modes = ShaderGenerator.Type;

            shader += this._writeShaderFromMode( state, validAttributeKeys, validTextureAttributeKeys, modes.FragmentInit );

            shader += this._writeShaderFromMode( state, validAttributeKeys, validTextureAttributeKeys, modes.FragmentFunction );

            shader += [
                'void main(void) {',
                '  fragColor = VertexColor;',
                ''
            ].join( '\n' );

            shader += this._writeShaderFromMode( state, validAttributeKeys, validTextureAttributeKeys, modes.FragmentMain );

            shader += this._writeShaderFromMode( state, validAttributeKeys, validTextureAttributeKeys, modes.FragmentEnd );

            shader += [
                '',
                '  gl_FragColor = fragColor;',
                '}'
            ].join( '\n' );

            return shader;
        }
    };

    return ShaderGenerator;
} );

define( 'osg/Light',[
    'osg/Utils',
    'osg/StateAttribute',
    'osg/Uniform',
    'osg/Matrix',
    'osg/Vec4',
    'osg/ShaderGenerator',
    'osg/Map'
], function ( MACROUTILS, StateAttribute, Uniform, Matrix, Vec4, ShaderGenerator, Map ) {

    /**
     *  Light
     *  @class Light
     */
    var Light = function ( lightNumber ) {
        StateAttribute.call( this );

        if ( lightNumber === undefined ) {
            lightNumber = 0;
        }

        this._ambient = [ 0.2, 0.2, 0.2, 1.0 ];
        this._diffuse = [ 0.8, 0.8, 0.8, 1.0 ];
        this._specular = [ 0.2, 0.2, 0.2, 1.0 ];
        this._position = [ 0.0, 0.0, 1.0, 0.0 ];
        this._direction = [ 0.0, 0.0, -1.0 ];
        this._spotCutoff = 180.0;
        this._spotBlend = 0.01;
        this._constantAttenuation = 1.0;
        this._linearAttenuation = 0.0;
        this._quadraticAttenuation = 0.0;
        this._lightUnit = lightNumber;
        this._enabled = 0;

        this.dirty();
    };

    /** @lends Light.prototype */
    Light.uniforms = {};
    Light.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( StateAttribute.prototype, {
        attributeType: 'Light',
        cloneType: function () {
            return new Light( this._lightUnit );
        },
        getType: function () {
            return this.attributeType;
        },
        getTypeMember: function () {
            return this.attributeType + this._lightUnit;
        },
        getOrCreateUniforms: function () {
            var uniforms = Light.uniforms;
            var typeMember = this.getTypeMember();
            if ( uniforms[ typeMember ] === undefined ) {
                var map = new Map();
                uniforms[ typeMember ] = map;

                var uFact = Uniform;
                map.setMapContent( {
                    'ambient': uFact.createFloat4( [ 0.2, 0.2, 0.2, 1 ], this.getUniformName( 'ambient' ) ),
                    'diffuse': uFact.createFloat4( [ 0.8, 0.8, 0.8, 1 ], this.getUniformName( 'diffuse' ) ),
                    'specular': uFact.createFloat4( [ 0.2, 0.2, 0.2, 1 ], this.getUniformName( 'specular' ) ),
                    'position': uFact.createFloat4( [ 0, 0, 1, 0 ], this.getUniformName( 'position' ) ),
                    'direction': uFact.createFloat3( [ 0, 0, 1 ], this.getUniformName( 'direction' ) ),
                    'spotCutoff': uFact.createFloat1( 180.0, this.getUniformName( 'spotCutoff' ) ),
                    'spotBlend': uFact.createFloat1( 0.01, this.getUniformName( 'spotBlend' ) ),
                    'constantAttenuation': uFact.createFloat1( 0, this.getUniformName( 'constantAttenuation' ) ),
                    'linearAttenuation': uFact.createFloat1( 0, this.getUniformName( 'linearAttenuation' ) ),
                    'quadraticAttenuation': uFact.createFloat1( 0, this.getUniformName( 'quadraticAttenuation' ) ),
                    'enable': uFact.createInt1( 0, this.getUniformName( 'enable' ) ),

                    'matrix': uFact.createMatrix4( Matrix.create(), this.getUniformName( 'matrix' ) ),
                    'invMatrix': uFact.createMatrix4( Matrix.create(), this.getUniformName( 'invMatrix' ) )
                });
            }
            return uniforms[ typeMember ];
        },

        setPosition: function ( pos ) {
            Vec4.copy( pos, this._position );
        },
        getPosition: function () {
            return this._position;
        },

        setAmbient: function ( a ) {
            this._ambient = a;
            this.dirty();
        },
        setSpecular: function ( a ) {
            this._specular = a;
            this.dirty();
        },
        setDiffuse: function ( a ) {
            this._diffuse = a;
            this.dirty();
        },

        setSpotCutoff: function ( a ) {
            this._spotCutoff = a;
            this.dirty();
        },
        getSpotCutoff: function () {
            return this._spotCutoff;
        },

        setSpotBlend: function ( a ) {
            this._spotBlend = a;
            this.dirty();
        },
        getSpotBlend: function () {
            return this._spotBlend;
        },

        setConstantAttenuation: function ( value ) {
            this._constantAttenuation = value;
            this.dirty();
        },
        setLinearAttenuation: function ( value ) {
            this._linearAttenuation = value;
            this.dirty();
        },
        setQuadraticAttenuation: function ( value ) {
            this._quadraticAttenuation = value;
            this.dirty();
        },

        setDirection: function ( a ) {
            this._direction = a;
            this.dirty();
        },
        getDirection: function () {
            return this._direction;
        },

        setLightNumber: function ( unit ) {
            this._lightUnit = unit;
            this.dirty();
        },
        getLightNumber: function () {
            return this._lightUnit;
        },

        getPrefix: function () {
            return this.getType() + this._lightUnit;
        },
        getParameterName: function ( name ) {
            return this.getPrefix() + '_' + name;
        },
        getUniformName: function ( name ) {
            return this.getPrefix() + '_uniform_' + name;
        },

        applyPositionedUniform: function ( matrix /*, state */ ) {
            var uniformMap = this.getOrCreateUniforms();
            var uniformMapContent = uniformMap.getMapContent();
            Matrix.copy( matrix, uniformMapContent.matrix.get() );
            uniformMapContent.matrix.dirty();

            Matrix.copy( matrix, uniformMapContent.invMatrix.get() );
            uniformMapContent.invMatrix.get()[ 12 ] = 0;
            uniformMapContent.invMatrix.get()[ 13 ] = 0;
            uniformMapContent.invMatrix.get()[ 14 ] = 0;
            Matrix.inverse( uniformMapContent.invMatrix.get(), uniformMapContent.invMatrix.get() );
            Matrix.transpose( uniformMapContent.invMatrix.get(), uniformMapContent.invMatrix.get() );
            uniformMapContent.invMatrix.dirty();
        },

        apply: function ( /*state*/ ) {
            var uniformMap = this.getOrCreateUniforms();
            var uniformMapContent = uniformMap.getMapContent();

            uniformMapContent.ambient.set( this._ambient );
            uniformMapContent.diffuse.set( this._diffuse );
            uniformMapContent.specular.set( this._specular );
            uniformMapContent.position.set( this._position );
            uniformMapContent.direction.set( this._direction );

            var spotsize = Math.cos( this._spotCutoff * Math.PI / 180.0 );
            uniformMapContent.spotCutoff.get()[ 0 ] = spotsize;
            uniformMapContent.spotCutoff.dirty();

            uniformMapContent.spotBlend.get()[ 0 ] = ( 1.0 - spotsize ) * this._spotBlend;
            uniformMapContent.spotBlend.dirty();

            uniformMapContent.constantAttenuation.get()[ 0 ] = this._constantAttenuation;
            uniformMapContent.constantAttenuation.dirty();

            uniformMapContent.linearAttenuation.get()[ 0 ] = this._linearAttenuation;
            uniformMapContent.linearAttenuation.dirty();

            uniformMapContent.quadraticAttenuation.get()[ 0 ] = this._quadraticAttenuation;
            uniformMapContent.quadraticAttenuation.dirty();

            //light._enable.set([this.enable]);

            this.setDirty( false );
        },


        _replace: function ( prefix, list, text, func ) {
            for ( var i = 0, l = list.length; i < l; i++ ) {
                var regex = new RegExp( prefix + list[ i ], 'g' );
                text = text.replace( regex, func.call( this, list[ i ] ) );
            }
            return text;
        },

        // will contain functions to generate shader
        _shader: {},
        _shaderCommon: {},

        generateShader: function ( type ) {
            if ( this._shader[ type ] ) {
                return this._shader[ type ].call( this );
            }
            return '';
        },

        generateShaderCommon: function ( type ) {
            if ( this._shaderCommon[ type ] ) {
                return this._shaderCommon[ type ].call( this );
            }
            return '';
        }


    } ), 'osg', 'Light' );


    // common shader generation functions
    Light.prototype._shaderCommon[ ShaderGenerator.Type.VertexInit ] = function () {
        return [ '',
            'varying vec3 FragNormal;',
            'varying vec3 FragEyeVector;',
            '',
            '' ].join( '\n' );
    };

    Light.prototype._shaderCommon[ ShaderGenerator.Type.VertexFunction ] = function () {
        return [ '',
            'vec3 computeNormal() {',
            '   return vec3(NormalMatrix * vec4(Normal, 0.0));',
            '}',
            '',
            'vec3 computeEyeVertex() {',
            '   return vec3(ModelViewMatrix * vec4(Vertex,1.0));',
            '}',
            '',
            '' ].join( '\n' );
    };

    Light.prototype._shaderCommon[ ShaderGenerator.Type.VertexMain ] = function () {
        return [ '',
            '  FragEyeVector = computeEyeVertex();',
            '  FragNormal = computeNormal();',
            '' ].join( '\n' );
    };

    Light.prototype._shaderCommon[ ShaderGenerator.Type.FragmentInit ] = function () {
        return [ 'varying vec3 FragNormal;',
            'varying vec3 FragEyeVector;',
            '' ].join( '\n' );
    };

    Light.prototype._shaderCommon[ ShaderGenerator.Type.FragmentFunction ] = function () {
        return [ '',
            'float getLightAttenuation(vec3 lightDir, float constant, float linear, float quadratic) {',
            '    ',
            '    float d = length(lightDir);',
            '    float att = 1.0 / ( constant + linear*d + quadratic*d*d);',
            '    return att;',
            '}',
            'vec4 computeLightContribution(vec4 materialAmbient,',
            '                              vec4 materialDiffuse,',
            '                              vec4 materialSpecular,',
            '                              float materialShininess,',
            '                              vec4 lightAmbient,',
            '                              vec4 lightDiffuse,',
            '                              vec4 lightSpecular,',
            '                              vec3 normal,',
            '                              vec3 eye,',
            '                              vec3 lightDirection,',
            '                              vec3 lightSpotDirection,',
            '                              float lightCosSpotCutoff,',
            '                              float lightSpotBlend,',
            '                              float lightAttenuation)',
            '{',
            '    vec3 L = lightDirection;',
            '    vec3 N = normal;',
            '    float NdotL = max(dot(L, N), 0.0);',
            '    float halfTerm = NdotL;',
            '    vec4 ambient = lightAmbient;',
            '    vec4 diffuse = vec4(0.0);',
            '    vec4 specular = vec4(0.0);',
            '    float spot = 0.0;',
            '',
            '    if (NdotL > 0.0) {',
            '        vec3 E = eye;',
            '        vec3 R = reflect(-L, N);',
            '        float RdotE = max(dot(R, E), 0.0);',
            '        if ( RdotE > 0.0) {',
            '           RdotE = pow( RdotE, materialShininess );',
            '        }',
            '        vec3 D = lightSpotDirection;',
            '        spot = 1.0;',
            '        if (lightCosSpotCutoff > 0.0) {',
            '          float cosCurAngle = dot(-L, D);',
            '          if (cosCurAngle < lightCosSpotCutoff) {',
            '             spot = 0.0;',
            '          } else {',
            '             if (lightSpotBlend > 0.0)',
            '               spot = cosCurAngle * smoothstep(0.0, 1.0, (cosCurAngle-lightCosSpotCutoff)/(lightSpotBlend));',
            '          }',
            '        }',

            '        diffuse = lightDiffuse * ((halfTerm));',
            '        specular = lightSpecular * RdotE;',
            '    }',
            '',
            '    return (materialAmbient*ambient + (materialDiffuse*diffuse + materialSpecular*specular) * spot) * lightAttenuation;',
            '}',
            'float linearrgb_to_srgb1(const in float c)',
            '{',
            '  float v = 0.0;',
            '  if(c < 0.0031308) {',
            '    if ( c > 0.0)',
            '      v = c * 12.92;',
            '  } else {',
            '    v = 1.055 * pow(c, 1.0/2.4) - 0.055;',
            '  }',
            '  return v;',
            '}',

            'vec4 linearrgb_to_srgb(const in vec4 col_from)',
            '{',
            '  vec4 col_to;',
            '  col_to.r = linearrgb_to_srgb1(col_from.r);',
            '  col_to.g = linearrgb_to_srgb1(col_from.g);',
            '  col_to.b = linearrgb_to_srgb1(col_from.b);',
            '  col_to.a = col_from.a;',
            '  return col_to;',
            '}',
            'float srgb_to_linearrgb1(const in float c)',
            '{',
            '  float v = 0.0;',
            '  if(c < 0.04045) {',
            '    if (c >= 0.0)',
            '      v = c * (1.0/12.92);',
            '  } else {',
            '    v = pow((c + 0.055)*(1.0/1.055), 2.4);',
            '  }',
            ' return v;',
            '}',
            'vec4 srgb2linear(const in vec4 col_from)',
            '{',
            '  vec4 col_to;',
            '  col_to.r = srgb_to_linearrgb1(col_from.r);',
            '  col_to.g = srgb_to_linearrgb1(col_from.g);',
            '  col_to.b = srgb_to_linearrgb1(col_from.b);',
            '  col_to.a = col_from.a;',
            '  return col_to;',
            '}',

            '' ].join( '\n' );
    };

    Light.prototype._shaderCommon[ ShaderGenerator.Type.FragmentMain ] = function () {
        return [ '',
            '  vec3 normal = normalize(FragNormal);',
            '  vec3 eyeVector = normalize(-FragEyeVector);',
            '  vec4 lightColor = MaterialEmission;',
            '' ].join( '\n' );
    };

    Light.prototype._shaderCommon[ ShaderGenerator.Type.FragmentEnd ] = function () {
        return [ '',
            '  fragColor *= lightColor;',
            '' ].join( '\n' );
    };


    // shader generation per instance of attribute
    Light.prototype._shader[ ShaderGenerator.Type.FragmentInit ] = function () {
        var str = [ '',
            'uniform vec4 Light_position;',
            'uniform vec3 Light_direction;',
            'uniform mat4 Light_matrix;',
            'uniform mat4 Light_invMatrix;',
            'uniform float Light_constantAttenuation;',
            'uniform float Light_linearAttenuation;',
            'uniform float Light_quadraticAttenuation;',
            'uniform vec4 Light_ambient;',
            'uniform vec4 Light_diffuse;',
            'uniform vec4 Light_specular;',
            'uniform float Light_spotCutoff;',
            'uniform float Light_spotBlend;',
            ''
        ].join( '\n' );

        // replace Light_xxxx by instance variable of 'this' light
        var uniformMapKeys = this.getOrCreateUniforms().getKeys();
        str = this._replace( 'Light_', uniformMapKeys, str, this.getUniformName );
        return str;
    };

    Light.prototype._shader[ ShaderGenerator.Type.FragmentMain ] = function () {
        var str = [ '',
            '  vec3 lightEye = vec3(Light_matrix * Light_position);',
            '  vec3 lightDir;',
            '  if (Light_position[3] == 1.0) {',
            '    lightDir = lightEye - FragEyeVector;',
            '  } else {',
            '    lightDir = lightEye;',
            '  }',
            '  vec3 spotDirection = normalize(mat3(vec3(Light_invMatrix[0]), vec3(Light_invMatrix[1]), vec3(Light_invMatrix[2]))*Light_direction);',
            '  float attenuation = getLightAttenuation(lightDir, Light_constantAttenuation, Light_linearAttenuation, Light_quadraticAttenuation);',
            '  lightDir = normalize(lightDir);',
            '  lightColor += computeLightContribution(MaterialAmbient,',
            '                                         MaterialDiffuse, ',
            '                                         MaterialSpecular,',
            '                                         MaterialShininess,',
            '                                         Light_ambient,',
            '                                         Light_diffuse,',
            '                                         Light_specular,',
            '                                         normal,',
            '                                         eyeVector,',
            '                                         lightDir,',
            '                                         spotDirection,',
            '                                         Light_spotCutoff,',
            '                                         Light_spotBlend,',
            '                                         attenuation);',
            ''
        ].join( '\n' );

        var fields = [ 'lightEye',
            'lightDir',
            'spotDirection',
            'attenuation'
        ];
        str = this._replace( '', fields, str, this.getParameterName );
        var uniformMapKeys = this.getOrCreateUniforms().getKeys();
        str = this._replace( 'Light_', uniformMapKeys, str, this.getUniformName );
        return str;
    };

    return Light;
} );

define( 'osg/LineWidth',[
    'osg/Utils',
    'osg/StateAttribute',
], function ( MACROUTILS, StateAttribute ) {

    var LineWidth = function ( lineWidth ) {
        StateAttribute.call( this );
        this.lineWidth = 1.0;
        if ( lineWidth !== undefined ) {
            this.lineWidth = lineWidth;
        }
    };
    LineWidth.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( StateAttribute.prototype, {
        attributeType: 'LineWidth',
        cloneType: function () {
            return new LineWidth();
        },
        getType: function () {
            return this.attributeType;
        },
        getTypeMember: function () {
            return this.attributeType;
        },
        apply: function ( state ) {
            state.getGraphicContext().lineWidth( this.lineWidth );
        }
    } ), 'osg', 'LineWidth' );

    return LineWidth;
} );

define( 'osg/Material',[
    'osg/Utils',
    'osg/StateAttribute',
    'osg/Vec4',
    'osg/Uniform',
    'osg/ShaderGenerator',
    'osg/Map'
], function ( MACROUTILS, StateAttribute, Vec4, Uniform, ShaderGenerator, Map ) {

    /**
     * Material
     * @class Material
     */
    var Material = function () {
        StateAttribute.call( this );
        this.ambient = [ 0.2, 0.2, 0.2, 1.0 ];
        this.diffuse = [ 0.8, 0.8, 0.8, 1.0 ];
        this.specular = [ 0.0, 0.0, 0.0, 1.0 ];
        this.emission = [ 0.0, 0.0, 0.0, 1.0 ];
        this.shininess = 12.5;
    };
    /** @lends Material.prototype */
    Material.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( StateAttribute.prototype, {
        setEmission: function ( a ) {
            Vec4.copy( a, this.emission );
            this._dirty = true;
        },
        setAmbient: function ( a ) {
            Vec4.copy( a, this.ambient );
            this._dirty = true;
        },
        setSpecular: function ( a ) {
            Vec4.copy( a, this.specular );
            this._dirty = true;
        },
        setDiffuse: function ( a ) {
            Vec4.copy( a, this.diffuse );
            this._dirty = true;
        },
        setShininess: function ( a ) {
            this.shininess = a;
            this._dirty = true;
        },

        getEmission: function () {
            return this.emission;
        },
        getAmbient: function () {
            return this.ambient;
        },
        getSpecular: function () {
            return this.specular;
        },
        getDiffuse: function () {
            return this.diffuse;
        },
        getShininess: function () {
            return this.shininess;
        },

        attributeType: 'Material',
        cloneType: function () {
            return new Material();
        },
        getType: function () {
            return this.attributeType;
        },
        getTypeMember: function () {
            return this.attributeType;
        },
        getOrCreateUniforms: function () {
            if ( Material.uniforms === undefined ) {
                var map = new Map();
                Material.uniforms = map;
                map.setMapContent( {
                    'ambient': Uniform.createFloat4( [ 0, 0, 0, 0 ], 'MaterialAmbient' ),
                    'diffuse': Uniform.createFloat4( [ 0, 0, 0, 0 ], 'MaterialDiffuse' ),
                    'specular': Uniform.createFloat4( [ 0, 0, 0, 0 ], 'MaterialSpecular' ),
                    'emission': Uniform.createFloat4( [ 0, 0, 0, 0 ], 'MaterialEmission' ),
                    'shininess': Uniform.createFloat1( [ 0 ], 'MaterialShininess' )
                } );
            }
            return Material.uniforms;
        },

        apply: function ( /*state*/ ) {
            var uniformMapContent = this.getOrCreateUniforms().getMapContent();

            uniformMapContent.ambient.set( this.ambient );
            uniformMapContent.diffuse.set( this.diffuse );
            uniformMapContent.specular.set( this.specular );
            uniformMapContent.emission.set( this.emission );
            uniformMapContent.shininess.set( [ this.shininess ] );
            this._dirty = false;
        },


        // will contain functions to generate shader
        _shader: {},
        _shaderCommon: {},

        generateShader: function ( type ) {
            if ( this._shader[ type ] ) {
                return this._shader[ type ].call( this );
            }
            return '';
        }

    } ), 'osg', 'Material' );


    Material.prototype._shader[ ShaderGenerator.Type.VertexInit ] = function () {
        var str = [ 'uniform vec4 MaterialAmbient;',
            'uniform vec4 MaterialDiffuse;',
            'uniform vec4 MaterialSpecular;',
            'uniform vec4 MaterialEmission;',
            'uniform float MaterialShininess;',
            ''
        ].join( '\n' );
        return str;
    };

    Material.prototype._shader[ ShaderGenerator.Type.FragmentInit ] = function () {
        var str = [ 'uniform vec4 MaterialAmbient;',
            'uniform vec4 MaterialDiffuse;',
            'uniform vec4 MaterialSpecular;',
            'uniform vec4 MaterialEmission;',
            'uniform float MaterialShininess;',
            ''
        ].join( '\n' );
        return str;
    };

    return Material;
} );

define( 'osg/Math',[], function () {

    var clamp = function ( x, min, max ) {
        // http://jsperf.com/math-clamp
        // http://jsperf.com/clamping-methods/2
        return Math.min( max, Math.max( min, x ) );
    };

    var smoothStep = function ( edge0, edge1, x ) {
        var t = clamp( ( x - edge0 ) / ( edge1 - edge0 ), 0.0, 1.0 );
        return t * t * ( 3.0 - 2.0 * t );
    };

    return {
        clamp: clamp,
        smoothStep: smoothStep
    };
} );

/*global define */

define( 'osg/Shape',[
    'osg/Notify',
    'osg/StateAttribute',
    'osg/Vec3',
    'osg/Uniform',
    'osg/BufferArray',
    'osg/Geometry',
    'osg/PrimitiveSet',
    'osg/DrawArrays',
    'osg/DrawElements',
    'osg/Program',
    'osg/Shader',
    'osg/Utils'
], function ( Notify, StateAttribute, Vec3, Uniform, BufferArray, Geometry, PrimitiveSet, DrawArrays, DrawElements, Program, Shader, MACROUTILS ) {

    /**
     * Create a Textured Box on the given center with given size
     * @name createTexturedBox
     */
    var createTexturedBoxGeometry = function ( centerx, centery, centerz,
        sizex, sizey, sizez ) {

        var g = new Geometry();
        var dx, dy, dz;
        dx = sizex / 2.0;
        dy = sizey / 2.0;
        dz = sizez / 2.0;

        var vertexes = new MACROUTILS.Float32Array( 72 );
        var uv = new MACROUTILS.Float32Array( 48 );
        var normal = new MACROUTILS.Float32Array( 72 );

        // -ve y plane
        vertexes[ 0 ] = centerx - dx;
        vertexes[ 1 ] = centery - dy;
        vertexes[ 2 ] = centerz + dz;
        normal[ 0 ] = 0.0;
        normal[ 1 ] = -1.0;
        normal[ 2 ] = 0.0;
        uv[ 0 ] = 0.0;
        uv[ 1 ] = 1.0;

        vertexes[ 3 ] = centerx - dx;
        vertexes[ 4 ] = centery - dy;
        vertexes[ 5 ] = centerz - dz;
        normal[ 3 ] = 0.0;
        normal[ 4 ] = -1.0;
        normal[ 5 ] = 0.0;
        uv[ 2 ] = 0.0;
        uv[ 3 ] = 0.0;

        vertexes[ 6 ] = centerx + dx;
        vertexes[ 7 ] = centery - dy;
        vertexes[ 8 ] = centerz - dz;
        normal[ 6 ] = 0.0;
        normal[ 7 ] = -1.0;
        normal[ 8 ] = 0.0;
        uv[ 4 ] = 1.0;
        uv[ 5 ] = 0.0;

        vertexes[ 9 ] = centerx + dx;
        vertexes[ 10 ] = centery - dy;
        vertexes[ 11 ] = centerz + dz;
        normal[ 9 ] = 0.0;
        normal[ 10 ] = -1.0;
        normal[ 11 ] = 0.0;
        uv[ 6 ] = 1.0;
        uv[ 7 ] = 1.0;


        // +ve y plane
        vertexes[ 12 ] = centerx + dx;
        vertexes[ 13 ] = centery + dy;
        vertexes[ 14 ] = centerz + dz;
        normal[ 12 ] = 0.0;
        normal[ 13 ] = 1.0;
        normal[ 14 ] = 0.0;
        uv[ 8 ] = 0.0;
        uv[ 9 ] = 1.0;

        vertexes[ 15 ] = centerx + dx;
        vertexes[ 16 ] = centery + dy;
        vertexes[ 17 ] = centerz - dz;
        normal[ 15 ] = 0.0;
        normal[ 16 ] = 1.0;
        normal[ 17 ] = 0.0;
        uv[ 10 ] = 0.0;
        uv[ 11 ] = 0.0;

        vertexes[ 18 ] = centerx - dx;
        vertexes[ 19 ] = centery + dy;
        vertexes[ 20 ] = centerz - dz;
        normal[ 18 ] = 0.0;
        normal[ 19 ] = 1.0;
        normal[ 20 ] = 0.0;
        uv[ 12 ] = 1.0;
        uv[ 13 ] = 0.0;

        vertexes[ 21 ] = centerx - dx;
        vertexes[ 22 ] = centery + dy;
        vertexes[ 23 ] = centerz + dz;
        normal[ 21 ] = 0.0;
        normal[ 22 ] = 1.0;
        normal[ 23 ] = 0.0;
        uv[ 14 ] = 1.0;
        uv[ 15 ] = 1.0;


        // +ve x plane
        vertexes[ 24 ] = centerx + dx;
        vertexes[ 25 ] = centery - dy;
        vertexes[ 26 ] = centerz + dz;
        normal[ 24 ] = 1.0;
        normal[ 25 ] = 0.0;
        normal[ 26 ] = 0.0;
        uv[ 16 ] = 0.0;
        uv[ 17 ] = 1.0;

        vertexes[ 27 ] = centerx + dx;
        vertexes[ 28 ] = centery - dy;
        vertexes[ 29 ] = centerz - dz;
        normal[ 27 ] = 1.0;
        normal[ 28 ] = 0.0;
        normal[ 29 ] = 0.0;
        uv[ 18 ] = 0.0;
        uv[ 19 ] = 0.0;

        vertexes[ 30 ] = centerx + dx;
        vertexes[ 31 ] = centery + dy;
        vertexes[ 32 ] = centerz - dz;
        normal[ 30 ] = 1.0;
        normal[ 31 ] = 0.0;
        normal[ 32 ] = 0.0;
        uv[ 20 ] = 1.0;
        uv[ 21 ] = 0.0;

        vertexes[ 33 ] = centerx + dx;
        vertexes[ 34 ] = centery + dy;
        vertexes[ 35 ] = centerz + dz;
        normal[ 33 ] = 1.0;
        normal[ 34 ] = 0.0;
        normal[ 35 ] = 0.0;
        uv[ 22 ] = 1.0;
        uv[ 23 ] = 1.0;

        // -ve x plane
        vertexes[ 36 ] = centerx - dx;
        vertexes[ 37 ] = centery + dy;
        vertexes[ 38 ] = centerz + dz;
        normal[ 36 ] = -1.0;
        normal[ 37 ] = 0.0;
        normal[ 38 ] = 0.0;
        uv[ 24 ] = 0.0;
        uv[ 25 ] = 1.0;

        vertexes[ 39 ] = centerx - dx;
        vertexes[ 40 ] = centery + dy;
        vertexes[ 41 ] = centerz - dz;
        normal[ 39 ] = -1.0;
        normal[ 40 ] = 0.0;
        normal[ 41 ] = 0.0;
        uv[ 26 ] = 0.0;
        uv[ 27 ] = 0.0;

        vertexes[ 42 ] = centerx - dx;
        vertexes[ 43 ] = centery - dy;
        vertexes[ 44 ] = centerz - dz;
        normal[ 42 ] = -1.0;
        normal[ 43 ] = 0.0;
        normal[ 44 ] = 0.0;
        uv[ 28 ] = 1.0;
        uv[ 29 ] = 0.0;

        vertexes[ 45 ] = centerx - dx;
        vertexes[ 46 ] = centery - dy;
        vertexes[ 47 ] = centerz + dz;
        normal[ 45 ] = -1.0;
        normal[ 46 ] = 0.0;
        normal[ 47 ] = 0.0;
        uv[ 30 ] = 1.0;
        uv[ 31 ] = 1.0;

        // top
        // +ve z plane
        vertexes[ 48 ] = centerx - dx;
        vertexes[ 49 ] = centery + dy;
        vertexes[ 50 ] = centerz + dz;
        normal[ 48 ] = 0.0;
        normal[ 49 ] = 0.0;
        normal[ 50 ] = 1.0;
        uv[ 32 ] = 0.0;
        uv[ 33 ] = 1.0;

        vertexes[ 51 ] = centerx - dx;
        vertexes[ 52 ] = centery - dy;
        vertexes[ 53 ] = centerz + dz;
        normal[ 51 ] = 0.0;
        normal[ 52 ] = 0.0;
        normal[ 53 ] = 1.0;
        uv[ 34 ] = 0.0;
        uv[ 35 ] = 0.0;

        vertexes[ 54 ] = centerx + dx;
        vertexes[ 55 ] = centery - dy;
        vertexes[ 56 ] = centerz + dz;
        normal[ 54 ] = 0.0;
        normal[ 55 ] = 0.0;
        normal[ 56 ] = 1.0;
        uv[ 36 ] = 1.0;
        uv[ 37 ] = 0.0;

        vertexes[ 57 ] = centerx + dx;
        vertexes[ 58 ] = centery + dy;
        vertexes[ 59 ] = centerz + dz;
        normal[ 57 ] = 0.0;
        normal[ 58 ] = 0.0;
        normal[ 59 ] = 1.0;
        uv[ 38 ] = 1.0;
        uv[ 39 ] = 1.0;

        // bottom
        // -ve z plane
        vertexes[ 60 ] = centerx + dx;
        vertexes[ 61 ] = centery + dy;
        vertexes[ 62 ] = centerz - dz;
        normal[ 60 ] = 0.0;
        normal[ 61 ] = 0.0;
        normal[ 62 ] = -1.0;
        uv[ 40 ] = 0.0;
        uv[ 41 ] = 1.0;

        vertexes[ 63 ] = centerx + dx;
        vertexes[ 64 ] = centery - dy;
        vertexes[ 65 ] = centerz - dz;
        normal[ 63 ] = 0.0;
        normal[ 64 ] = 0.0;
        normal[ 65 ] = -1.0;
        uv[ 42 ] = 0.0;
        uv[ 43 ] = 0.0;

        vertexes[ 66 ] = centerx - dx;
        vertexes[ 67 ] = centery - dy;
        vertexes[ 68 ] = centerz - dz;
        normal[ 66 ] = 0.0;
        normal[ 67 ] = 0.0;
        normal[ 68 ] = -1.0;
        uv[ 44 ] = 1.0;
        uv[ 45 ] = 0.0;

        vertexes[ 69 ] = centerx - dx;
        vertexes[ 70 ] = centery + dy;
        vertexes[ 71 ] = centerz - dz;
        normal[ 69 ] = 0.0;
        normal[ 70 ] = 0.0;
        normal[ 71 ] = -1.0;
        uv[ 46 ] = 1.0;
        uv[ 47 ] = 1.0;

        var indexes = new MACROUTILS.Uint16Array( 36 );
        indexes[ 0 ] = 0;
        indexes[ 1 ] = 1;
        indexes[ 2 ] = 2;
        indexes[ 3 ] = 0;
        indexes[ 4 ] = 2;
        indexes[ 5 ] = 3;

        indexes[ 6 ] = 4;
        indexes[ 7 ] = 5;
        indexes[ 8 ] = 6;
        indexes[ 9 ] = 4;
        indexes[ 10 ] = 6;
        indexes[ 11 ] = 7;

        indexes[ 12 ] = 8;
        indexes[ 13 ] = 9;
        indexes[ 14 ] = 10;
        indexes[ 15 ] = 8;
        indexes[ 16 ] = 10;
        indexes[ 17 ] = 11;

        indexes[ 18 ] = 12;
        indexes[ 19 ] = 13;
        indexes[ 20 ] = 14;
        indexes[ 21 ] = 12;
        indexes[ 22 ] = 14;
        indexes[ 23 ] = 15;

        indexes[ 24 ] = 16;
        indexes[ 25 ] = 17;
        indexes[ 26 ] = 18;
        indexes[ 27 ] = 16;
        indexes[ 28 ] = 18;
        indexes[ 29 ] = 19;

        indexes[ 30 ] = 20;
        indexes[ 31 ] = 21;
        indexes[ 32 ] = 22;
        indexes[ 33 ] = 20;
        indexes[ 34 ] = 22;
        indexes[ 35 ] = 23;

        g.getAttributes().Vertex = new BufferArray( BufferArray.ARRAY_BUFFER, vertexes, 3 );
        g.getAttributes().Normal = new BufferArray( BufferArray.ARRAY_BUFFER, normal, 3 );
        g.getAttributes().TexCoord0 = new BufferArray( BufferArray.ARRAY_BUFFER, uv, 2 );

        var primitive = new DrawElements( PrimitiveSet.TRIANGLES, new BufferArray( BufferArray.ELEMENT_ARRAY_BUFFER, indexes, 1 ) );
        g.getPrimitives().push( primitive );
        return g;
    };

    var createTexturedQuadGeometry = function ( cornerx, cornery, cornerz,
        wx, wy, wz,
        hx, hy, hz,
        l, b, r, t ) {

        if ( r === undefined && t === undefined ) {
            r = l;
            t = b;
            l = 0.0;
            b = 0.0;
        }

        var g = new Geometry();

        var vertexes = new MACROUTILS.Float32Array( 12 );
        vertexes[ 0 ] = cornerx + hx;
        vertexes[ 1 ] = cornery + hy;
        vertexes[ 2 ] = cornerz + hz;

        vertexes[ 3 ] = cornerx;
        vertexes[ 4 ] = cornery;
        vertexes[ 5 ] = cornerz;

        vertexes[ 6 ] = cornerx + wx;
        vertexes[ 7 ] = cornery + wy;
        vertexes[ 8 ] = cornerz + wz;

        vertexes[ 9 ] = cornerx + wx + hx;
        vertexes[ 10 ] = cornery + wy + hy;
        vertexes[ 11 ] = cornerz + wz + hz;

        if ( r === undefined ) {
            r = 1.0;
        }
        if ( t === undefined ) {
            t = 1.0;
        }

        var uvs = new MACROUTILS.Float32Array( 8 );
        uvs[ 0 ] = l;
        uvs[ 1 ] = t;

        uvs[ 2 ] = l;
        uvs[ 3 ] = b;

        uvs[ 4 ] = r;
        uvs[ 5 ] = b;

        uvs[ 6 ] = r;
        uvs[ 7 ] = t;

        var n = Vec3.cross( [ wx, wy, wz ], [ hx, hy, hz ], [ 0.0, 0.0, 0.0 ] );
        var normal = new MACROUTILS.Float32Array( 12 );
        normal[ 0 ] = n[ 0 ];
        normal[ 1 ] = n[ 1 ];
        normal[ 2 ] = n[ 2 ];

        normal[ 3 ] = n[ 0 ];
        normal[ 4 ] = n[ 1 ];
        normal[ 5 ] = n[ 2 ];

        normal[ 6 ] = n[ 0 ];
        normal[ 7 ] = n[ 1 ];
        normal[ 8 ] = n[ 2 ];

        normal[ 9 ] = n[ 0 ];
        normal[ 10 ] = n[ 1 ];
        normal[ 11 ] = n[ 2 ];


        var indexes = new MACROUTILS.Uint16Array( 6 );
        indexes[ 0 ] = 0;
        indexes[ 1 ] = 1;
        indexes[ 2 ] = 2;
        indexes[ 3 ] = 0;
        indexes[ 4 ] = 2;
        indexes[ 5 ] = 3;

        g.getAttributes().Vertex = new BufferArray( BufferArray.ARRAY_BUFFER, vertexes, 3 );
        g.getAttributes().Normal = new BufferArray( BufferArray.ARRAY_BUFFER, normal, 3 );
        g.getAttributes().TexCoord0 = new BufferArray( BufferArray.ARRAY_BUFFER, uvs, 2 );

        var primitive = new DrawElements( PrimitiveSet.TRIANGLES, new BufferArray( BufferArray.ELEMENT_ARRAY_BUFFER, indexes, 1 ) );
        g.getPrimitives().push( primitive );
        return g;
    };

    var createTexturedBox = function ( centerx, centery, centerz,
        sizex, sizey, sizez ) {
        Notify.log( 'createTexturedBox is deprecated use instead createTexturedBoxGeometry' );
        return createTexturedBoxGeometry( centerx, centery, centerz,
            sizex, sizey, sizez );
    };

    var createTexturedQuad = function ( cornerx, cornery, cornerz,
        wx, wy, wz,
        hx, hy, hz,
        l, b, r, t ) {
        Notify.log( 'createTexturedQuad is deprecated use instead createTexturedQuadGeometry' );
        return createTexturedQuadGeometry( cornerx, cornery, cornerz,
            wx, wy, wz,
            hx, hy, hz,
            l, b, r, t );
    };

    var createAxisGeometry = function ( size ) {
        if ( size === undefined ) {
            size = 5.0;
        }
        if ( createAxisGeometry.getShader === undefined ) {
            createAxisGeometry.getShader = function () {
                if ( createAxisGeometry.getShader.program === undefined ) {
                    var vertexshader = [
                        '#ifdef GL_ES',
                        'precision highp float;',
                        '#endif',
                        'attribute vec3 Vertex;',
                        'attribute vec4 Color;',
                        'uniform mat4 ModelViewMatrix;',
                        'uniform mat4 ProjectionMatrix;',
                        '',
                        'varying vec4 FragColor;',
                        '',
                        'vec4 ftransform() {',
                        'return ProjectionMatrix * ModelViewMatrix * vec4(Vertex, 1.0);',
                        '}',
                        '',
                        'void main(void) {',
                        'gl_Position = ftransform();',
                        'FragColor = Color;',
                        '}'
                    ].join( '\n' );

                    var fragmentshader = [
                        '#ifdef GL_ES',
                        'precision highp float;',
                        '#endif',
                        'varying vec4 FragColor;',

                        'void main(void) {',
                        'gl_FragColor = FragColor;',
                        '}'
                    ].join( '\n' );

                    var program = new Program( new Shader( 'VERTEX_SHADER', vertexshader ),
                        new Shader( 'FRAGMENT_SHADER', fragmentshader ) );
                    createAxisGeometry.getShader.program = program;
                }
                return createAxisGeometry.getShader.program;
            };
        }

        var g = new Geometry();

        var vertexes = new MACROUTILS.Float32Array( 18 );
        vertexes[ 3 ] = size;
        vertexes[ 10 ] = size;
        vertexes[ 17 ] = size;

        var colors = new MACROUTILS.Float32Array( 24 );
        //red color
        colors[ 0 ] = colors[ 3 ] = 1.0;
        colors[ 4 ] = colors[ 4 + 3 ] = 1.0;
        //green color
        colors[ 4 * 2 + 1 ] = colors[ 4 * 2 + 3 ] = 1.0;
        colors[ 4 * 3 + 1 ] = colors[ 4 * 3 + 3 ] = 1.0;
        //blue color
        colors[ 4 * 4 + 2 ] = colors[ 4 * 4 + 3 ] = 1.0;
        colors[ 4 * 5 + 2 ] = colors[ 4 * 5 + 3 ] = 1.0;

        g.getAttributes().Vertex = new BufferArray( BufferArray.ARRAY_BUFFER, vertexes, 3 );
        g.getAttributes().Color = new BufferArray( BufferArray.ARRAY_BUFFER, colors, 4 );

        var primitive = new DrawArrays( PrimitiveSet.LINES, 0, 6 );
        g.getPrimitives().push( primitive );
        g.getOrCreateStateSet().setAttributeAndMode( createAxisGeometry.getShader() );

        return g;
    };

    /**
     * Create a Textured Sphere on the given center with given radius
     * @name createTexturedSphere
     * @author Darrell Esau
     */
    var createTexturedSphere = function ( radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength ) {
        radius = radius || 50.0;

        phiStart = phiStart !== undefined ? phiStart : 0.0;
        phiLength = phiLength !== undefined ? phiLength : Math.PI * 2;

        thetaStart = thetaStart !== undefined ? thetaStart : 0.0;
        thetaLength = thetaLength !== undefined ? thetaLength : Math.PI;

        var segmentsX = Math.max( 3, Math.floor( widthSegments ) || 8 );
        var segmentsY = Math.max( 2, Math.floor( heightSegments ) || 6 );

        var useDrawArrays = ( ( segmentsX * segmentsY ) / 3 ) >= 65536;
        var nbPrim = useDrawArrays ? segmentsX * segmentsY * 6 : segmentsX * segmentsY * 4;
        var fullVerticesList = new MACROUTILS.Float32Array( nbPrim * 3 );
        var fullNormalsList = new MACROUTILS.Float32Array( nbPrim * 3 );
        var fullUVList = new MACROUTILS.Float32Array( nbPrim * 2 );
        var indexes = !useDrawArrays ? new MACROUTILS.Uint16Array( segmentsX * segmentsY * 6 ) : undefined;
        var vtxCount = 0;
        var triCount = 0;

        var v1 = new MACROUTILS.Float32Array( 3 );
        var v2 = new MACROUTILS.Float32Array( 3 );
        var v3 = new MACROUTILS.Float32Array( 3 );
        var v4 = new MACROUTILS.Float32Array( 3 );
        var n1 = new MACROUTILS.Float32Array( 3 );
        var n2 = new MACROUTILS.Float32Array( 3 );
        var n3 = new MACROUTILS.Float32Array( 3 );
        var n4 = new MACROUTILS.Float32Array( 3 );
        var uv1 = new MACROUTILS.Float32Array( 2 );
        var uv2 = new MACROUTILS.Float32Array( 2 );
        var uv3 = new MACROUTILS.Float32Array( 2 );
        var uv4 = new MACROUTILS.Float32Array( 2 );
        var getCoordAndUvSphere = function ( u, v, coord, norm, uv ) {
            coord[ 0 ] = -radius * Math.cos( phiStart + u * phiLength ) * Math.sin( thetaStart + v * thetaLength );
            coord[ 1 ] = radius * Math.cos( thetaStart + v * thetaLength );
            coord[ 2 ] = radius * Math.sin( phiStart + u * phiLength ) * Math.sin( thetaStart + v * thetaLength );
            Vec3.normalize( coord, norm );
            uv[ 0 ] = u;
            uv[ 1 ] = 1 - v;
        };
        for ( var y = 0; y < segmentsY; y++ ) {
            for ( var x = 0; x < segmentsX; x++ ) {
                getCoordAndUvSphere( ( x + 1 ) / segmentsX, y / segmentsY, v1, n1, uv1 );
                getCoordAndUvSphere( x / segmentsX, y / segmentsY, v2, n2, uv2 );
                getCoordAndUvSphere( x / segmentsX, ( y + 1 ) / segmentsY, v3, n3, uv3 );
                getCoordAndUvSphere( ( x + 1 ) / segmentsX, ( y + 1 ) / segmentsY, v4, n4, uv4 );

                var idv = vtxCount * 3;
                fullVerticesList[ idv ] = v1[ 0 ];
                fullVerticesList[ idv + 1 ] = v1[ 1 ];
                fullVerticesList[ idv + 2 ] = v1[ 2 ];
                fullVerticesList[ idv + 3 ] = v2[ 0 ];
                fullVerticesList[ idv + 4 ] = v2[ 1 ];
                fullVerticesList[ idv + 5 ] = v2[ 2 ];
                fullVerticesList[ idv + 6 ] = v3[ 0 ];
                fullVerticesList[ idv + 7 ] = v3[ 1 ];
                fullVerticesList[ idv + 8 ] = v3[ 2 ];

                fullNormalsList[ idv ] = n1[ 0 ];
                fullNormalsList[ idv + 1 ] = n1[ 1 ];
                fullNormalsList[ idv + 2 ] = n1[ 2 ];
                fullNormalsList[ idv + 3 ] = n2[ 0 ];
                fullNormalsList[ idv + 4 ] = n2[ 1 ];
                fullNormalsList[ idv + 5 ] = n2[ 2 ];
                fullNormalsList[ idv + 6 ] = n3[ 0 ];
                fullNormalsList[ idv + 7 ] = n3[ 1 ];
                fullNormalsList[ idv + 8 ] = n3[ 2 ];

                var idu = vtxCount * 2;
                fullUVList[ idu ] = uv1[ 0 ];
                fullUVList[ idu + 1 ] = uv1[ 1 ];
                fullUVList[ idu + 2 ] = uv2[ 0 ];
                fullUVList[ idu + 3 ] = uv2[ 1 ];
                fullUVList[ idu + 4 ] = uv3[ 0 ];
                fullUVList[ idu + 5 ] = uv3[ 1 ];

                vtxCount += 3;
                if ( useDrawArrays ) {
                    idv = vtxCount * 3;
                    fullVerticesList[ idv ] = v1[ 0 ];
                    fullVerticesList[ idv + 1 ] = v1[ 1 ];
                    fullVerticesList[ idv + 2 ] = v1[ 2 ];
                    fullVerticesList[ idv + 3 ] = v3[ 0 ];
                    fullVerticesList[ idv + 4 ] = v3[ 1 ];
                    fullVerticesList[ idv + 5 ] = v3[ 2 ];
                    fullVerticesList[ idv + 6 ] = v4[ 0 ];
                    fullVerticesList[ idv + 7 ] = v4[ 1 ];
                    fullVerticesList[ idv + 8 ] = v4[ 2 ];

                    fullNormalsList[ idv ] = n1[ 0 ];
                    fullNormalsList[ idv + 1 ] = n1[ 1 ];
                    fullNormalsList[ idv + 2 ] = n1[ 2 ];
                    fullNormalsList[ idv + 3 ] = n3[ 0 ];
                    fullNormalsList[ idv + 4 ] = n3[ 1 ];
                    fullNormalsList[ idv + 5 ] = n3[ 2 ];
                    fullNormalsList[ idv + 6 ] = n4[ 0 ];
                    fullNormalsList[ idv + 7 ] = n4[ 1 ];
                    fullNormalsList[ idv + 8 ] = n4[ 2 ];

                    idu = vtxCount * 2;
                    fullUVList[ idu ] = uv1[ 0 ];
                    fullUVList[ idu + 1 ] = uv1[ 1 ];
                    fullUVList[ idu + 2 ] = uv3[ 0 ];
                    fullUVList[ idu + 3 ] = uv3[ 1 ];
                    fullUVList[ idu + 4 ] = uv4[ 0 ];
                    fullUVList[ idu + 5 ] = uv4[ 1 ];
                    vtxCount += 3;
                } else {
                    idv = vtxCount * 3;
                    fullVerticesList[ idv ] = v4[ 0 ];
                    fullVerticesList[ idv + 1 ] = v4[ 1 ];
                    fullVerticesList[ idv + 2 ] = v4[ 2 ];

                    fullNormalsList[ idv ] = n4[ 0 ];
                    fullNormalsList[ idv + 1 ] = n4[ 1 ];
                    fullNormalsList[ idv + 2 ] = n4[ 2 ];

                    idu = vtxCount * 2;
                    fullUVList[ idu ] = uv4[ 0 ];
                    fullUVList[ idu + 1 ] = uv4[ 1 ];

                    var iStart = triCount * 3;
                    var tristart = vtxCount - 3;
                    indexes[ iStart ] = tristart;
                    indexes[ iStart + 1 ] = tristart + 1;
                    indexes[ iStart + 2 ] = tristart + 2;
                    indexes[ iStart + 3 ] = tristart;
                    indexes[ iStart + 4 ] = tristart + 2;
                    indexes[ iStart + 5 ] = tristart + 3;
                    triCount += 2;
                    vtxCount += 1;
                }
            }
        }

        var g = new Geometry();
        g.getAttributes().Vertex = new BufferArray( 'ARRAY_BUFFER', fullVerticesList, 3 );
        g.getAttributes().Normal = new BufferArray( 'ARRAY_BUFFER', fullNormalsList, 3 );
        g.getAttributes().TexCoord0 = new BufferArray( 'ARRAY_BUFFER', fullUVList, 2 );

        if ( useDrawArrays )
            g.getPrimitives().push( new DrawArrays( PrimitiveSet.TRIANGLES, 0, fullVerticesList.length / 3 ) );
        else
            g.getPrimitives().push( new DrawElements( PrimitiveSet.TRIANGLES, new BufferArray( 'ELEMENT_ARRAY_BUFFER', indexes, 1 ) ) );
        return g;
    };

    return {
        createTexturedBoxGeometry: createTexturedBoxGeometry,
        createTexturedQuadGeometry: createTexturedQuadGeometry,
        createTexturedBox: createTexturedBox,
        createTexturedQuad: createTexturedQuad,
        createAxisGeometry: createAxisGeometry,
        createTexturedSphere: createTexturedSphere
    };
} );

define( 'osg/Stack',[], function () {

    var Stack = function () {};
    Stack.create = function () {
        var a = [];
        a.globalDefault = undefined;
        a.lastApplied = undefined;
        a.back = function () {
            return this[ this.length - 1 ];
        };
        return a;
    };

    return Stack;
} );

define( 'osg/State',[
    'osg/StateAttribute',
    'osg/Stack',
    'osg/Uniform',
    'osg/Matrix',
    'osg/ShaderGenerator',
    'osg/Map'
], function ( StateAttribute, Stack, Uniform, Matrix, ShaderGenerator, Map ) {

    var State = function () {
        this._graphicContext = undefined;

        this.currentVBO = null;
        this.vertexAttribList = [];
        this.programs = Stack.create();
        this.stateSets = Stack.create();
        this.uniforms = new Map();

        this.textureAttributeMapList = [];

        this.attributeMap = new Map();

        this.shaderGenerator = new ShaderGenerator();

        this.modelViewMatrix = Uniform.createMatrix4( Matrix.create(), 'ModelViewMatrix' );
        this.projectionMatrix = Uniform.createMatrix4( Matrix.create(), 'ProjectionMatrix' );
        this.normalMatrix = Uniform.createMatrix4( Matrix.create(), 'NormalMatrix' );

        // track uniform for color array enabled

        // Stoped HERE color array does not work
        // check point cloud example
        var arrayColorEnable = Stack.create();
        arrayColorEnable.globalDefault = Uniform.createFloat1( 0.0, 'ArrayColorEnabled' );
        this.uniforms.setMapContent( {
            ArrayColorEnabled: arrayColorEnable
        } );


        this.vertexAttribMap = {};
        this.vertexAttribMap._disable = [];
        this.vertexAttribMap._keys = [];
    };

    State.prototype = {

        setGraphicContext: function ( graphicContext ) {
            this._graphicContext = graphicContext;
        },
        getGraphicContext: function () {
            return this._graphicContext;
        },

        pushStateSet: function ( stateset ) {
            this.stateSets.push( stateset );

            if ( stateset.attributeMap ) {
                this.pushAttributeMap( this.attributeMap, stateset.attributeMap );
            }
            if ( stateset.textureAttributeMapList ) {
                var list = stateset.textureAttributeMapList;
                for ( var textureUnit = 0, l = list.length; textureUnit < l; textureUnit++ ) {
                    if ( list[ textureUnit ] === undefined ) {
                        continue;
                    }
                    if ( !this.textureAttributeMapList[ textureUnit ] ) {
                        this.textureAttributeMapList[ textureUnit ] = new Map();
                    }
                    this.pushAttributeMap( this.textureAttributeMapList[ textureUnit ], list[ textureUnit ] );
                }
            }

            if ( stateset.uniforms ) {
                this.pushUniformsList( this.uniforms, stateset.uniforms );
            }
        },

        applyStateSet: function ( stateset ) {
            this.pushStateSet( stateset );
            this.apply();
            this.popStateSet();
        },

        popAllStateSets: function () {
            while ( this.stateSets.length ) {
                this.popStateSet();
            }
        },
        popStateSet: function () {
            var stateset = this.stateSets.pop();
            if ( stateset.program ) {
                this.programs.pop();
            }
            if ( stateset.attributeMap ) {
                this.popAttributeMap( this.attributeMap, stateset.attributeMap );
            }
            if ( stateset.textureAttributeMapList ) {
                var list = stateset.textureAttributeMapList;
                for ( var textureUnit = 0, l = list.length; textureUnit < l; textureUnit++ ) {
                    if ( list[ textureUnit ] === undefined ) {
                        continue;
                    }
                    this.popAttributeMap( this.textureAttributeMapList[ textureUnit ], list[ textureUnit ] );
                }
            }

            if ( stateset.uniforms ) {
                this.popUniformsList( this.uniforms, stateset.uniforms );
            }
        },

        haveAppliedAttribute: function ( attribute ) {
            var key = attribute.getTypeMember();
            var attributeStack = this.attributeMap.getMapContent()[ key ];
            attributeStack.lastApplied = attribute;
            attributeStack.asChanged = true;
        },

        applyAttribute: function ( attribute ) {
            var key = attribute.getTypeMember();

            var attributeMapContent = this.attributeMap.getMapContent();
            var attributeStack = attributeMapContent[ key ];

            if ( attributeStack === undefined ) {
                attributeStack = Stack.create();
                attributeMapContent[ key ] = attributeStack;
                attributeMapContent[ key ].globalDefault = attribute.cloneType();
                this.attributeMap.dirty();
            }

            if ( attributeStack.lastApplied !== attribute ) {
                //        if (attributeStack.lastApplied !== attribute || attribute.isDirty()) {
                if ( attribute.apply ) {
                    attribute.apply( this );
                }
                attributeStack.lastApplied = attribute;
                attributeStack.asChanged = true;
            }
        },
        applyTextureAttribute: function ( unit, attribute ) {
            var gl = this.getGraphicContext();
            gl.activeTexture( gl.TEXTURE0 + unit );
            var key = attribute.getTypeMember();

            if ( !this.textureAttributeMapList[ unit ] ) {
                this.textureAttributeMapList[ unit ] = new Map();
            }

            var textureUnitAttributeMap = this.textureAttributeMapList[ unit ];
            var textureUnitAttributeMapContent = textureUnitAttributeMap.getMapContent();
            var attributeStack = textureUnitAttributeMapContent[ key ];

            if ( attributeStack === undefined ) {

                attributeStack = Stack.create();
                textureUnitAttributeMapContent[ key ] = attributeStack;
                textureUnitAttributeMap.dirty();
                attributeStack.globalDefault = attribute.cloneType();

            }

            if ( attributeStack.lastApplied !== attribute ) {

                if ( attribute.apply ) {
                    attribute.apply( this );
                }
                attributeStack.lastApplied = attribute;
                attributeStack.asChanged = true;
            }
        },

        getLastProgramApplied: function () {
            return this.programs.lastApplied;
        },

        pushGeneratedProgram: function () {
            var program;
            var attributeMapContent = this.attributeMap.getMapContent();

            if ( attributeMapContent.Program !== undefined && attributeMapContent.Program.length !== 0 ) {
                program = attributeMapContent.Program.back().object;
                var value = attributeMapContent.Program.back().value;
                if ( program !== undefined && value !== StateAttribute.OFF ) {
                    this.programs.push( this.getObjectPair( program, value ) );
                    return program;
                }
            }

            var attributes = {
                'textureAttributeMapList': this.textureAttributeMapList,
                'attributeMap': this.attributeMap
            };

            var generator = this.stateSets.back().getShaderGenerator();
            if ( generator === undefined ) {
                generator = this.shaderGenerator;
            }
            program = generator.getOrCreateProgram( attributes );
            this.programs.push( this.getObjectPair( program, StateAttribute.ON ) );
            return program;
        },

        popGeneratedProgram: function () {
            this.programs.pop();
        },

        applyWithoutProgram: function () {
            this.applyAttributeMap( this.attributeMap );
            this.applyTextureAttributeMapList( this.textureAttributeMapList );
        },

        computeForeignUniforms: function( programUniformMap, activeUniformMap ) {
            var uniformMapKeys = programUniformMap.getKeys();
            var uniformMapContent = programUniformMap.getMapContent();

            var foreignUniforms = [];
            for ( var i = 0, l = uniformMapKeys.length; i < l; i++ ) {
                var name = uniformMapKeys[ i ];
                var location = uniformMapContent[ name ];
                if ( location !== undefined && activeUniformMap[ name ] === undefined ) {
                    // filter 'standard' uniform matrix that will be applied for all shader
                    if ( name !== this.modelViewMatrix.name &&
                         name !== this.projectionMatrix.name &&
                         name !== this.normalMatrix.name &&
                         name !== 'ArrayColorEnabled' ) {
                             foreignUniforms.push( name );
                         }
                }
            }
            return foreignUniforms;
        },

        removeUniformsNotRequiredByProgram: function( activeUniformMap, programUniformMap ) {
            var activeUniformMapContent = activeUniformMap.getMapContent();
            var activeUniformMapKeys = activeUniformMap.getKeys();

            for ( var i = 0, l = activeUniformMapKeys.length; i < l; i++ ) {
                var name = activeUniformMapKeys[ i ];
                var location = programUniformMap[ name ];
                if ( location === undefined || location === null ) {
                    delete activeUniformMapContent[ name ];
                    activeUniformMap.dirty();
                }
            }
        },



        cacheUniformsForGeneratedProgram: function( program ) {

            var foreignUniforms = this.computeForeignUniforms( program.uniformsCache, program.activeUniforms.getMapContent() );
            program.foreignUniforms = foreignUniforms;


            // remove uniforms listed by attributes (getActiveUniforms) but not required by the program
            this.removeUniformsNotRequiredByProgram( program.activeUniforms, program.uniformsCache.getMapContent() );

        },

        applyGeneratedProgram: function( program ) {

            // note that about TextureAttribute that need uniform on unit we would need to improve
            // the current uniformList ...

            // when we apply the shader for the first time, we want to compute the active uniforms for this shader and the list of uniforms not extracted from attributes called foreignUniforms

            // typically the following code will be executed once on the first execution of generated program

            var foreignUniformKeys = program.foreignUniforms;
            if ( !foreignUniformKeys ) {
                this.cacheUniformsForGeneratedProgram( program );
                foreignUniformKeys = program.foreignUniforms;
            }


            var programUniforms = program.uniformsCache;
            var activeUniforms = program.activeUniforms;

            var programUniformMapContent = programUniforms.getMapContent();
            var activeUniformMapKeys = activeUniforms.getMapContent();

            // apply active uniforms
            // caching uniforms from attribtues make it impossible to overwrite uniform with a custom uniform instance not used in the attributes
            var i,l, name, location;
            var activeUniformKeys = activeUniforms.getKeys();

            for ( i = 0, l = activeUniformKeys.length; i < l; i++ ) {

                name = activeUniformKeys[ i ];
                location = programUniformMapContent[ name ];
                activeUniformMapKeys[ name ].apply( this._graphicContext, location );

            }

            var uniformMapStackContent = this.uniforms.getMapContent();

            // apply now foreign uniforms, it's uniforms needed by the program but not contains in attributes used to generate this program
            for ( i = 0, l = foreignUniformKeys.length; i < l; i++ ) {

                name = foreignUniformKeys[ i ];
                var uniformStack = uniformMapStackContent[ name ];
                location = programUniformMapContent[ name ];
                var uniform;

                if ( uniformStack !== undefined ) {

                    if ( uniformStack.length === 0 ) {
                        uniform = uniformStack.globalDefault;
                    } else {
                        uniform = uniformStack.back().object;
                    }

                    uniform.apply( this._graphicContext, location );
                }

            }
        },

        apply: function () {
            this.applyAttributeMap( this.attributeMap );
            this.applyTextureAttributeMapList( this.textureAttributeMapList );

            this.pushGeneratedProgram();
            var program = this.programs.back().object;
            if ( this.programs.lastApplied !== program ) {
                program.apply( this );
                this.programs.lastApplied = program;
            }

            if ( program.generated === true ) {

                // will cache uniform and apply them with the program

                this.applyGeneratedProgram( program );

            } else {

                // custom program so we will iterate on uniform from the program and apply them
                // but in order to be able to use Attribute in the state graph we will check if
                // our program want them. It must be defined by the user
                this.applyCustomProgram( program );

            }
        },



        getActiveUniformsFromProgramAttributes: function( program, activeUniformsList ) {

            var attributeMapStackContent = this.attributeMap.getMapContent();

            var attributeKeys = program.trackAttributes.attributeKeys;
            if ( attributeKeys.length > 0 ) {
                for ( var i = 0, l = attributeKeys.length; i < l; i++ ) {
                    var key = attributeKeys[ i ];
                    var attributeStack = attributeMapStackContent[ key ];
                    if ( attributeStack === undefined ) {
                        continue;
                    }
                    // we just need the uniform list and not the attribute itself
                    var attribute = attributeStack.globalDefault;
                    if ( attribute.getOrCreateUniforms === undefined ) {
                        continue;
                    }
                    var uniforms = attribute.getOrCreateUniforms();
                    var uniformKeys = uniforms.getKeys();
                    var uniformMap = uniforms.getMapContent();
                    for ( var a = 0, b = uniformKeys.length; a < b; a++ ) {
                        activeUniformsList.push( uniformMap[ uniformKeys[ a ] ] );
                    }
                }
            }
        },

        getActiveUniformsFromProgramTextureAttributes: function( program, activeUniformsList ) {

            var textureAttributeKeysList = program.trackAttributes.textureAttributeKeys;
            if ( textureAttributeKeysList === undefined ) return;

            for ( var unit = 0, nbUnit = textureAttributeKeysList.length; unit < nbUnit; unit++ ) {

                var textureAttributeKeys = textureAttributeKeysList[ unit ];
                if ( textureAttributeKeys === undefined ) continue;

                var unitTextureAttributeList = this.textureAttributeMapList[ unit ];
                if ( unitTextureAttributeList === undefined ) continue;

                for ( var i = 0, l = textureAttributeKeys.length; i < l; i++ ) {
                    var key = textureAttributeKeys[ i ];

                    var attributeStack = unitTextureAttributeList[ key ];
                    if ( attributeStack === undefined ) {
                        continue;
                    }
                    // we just need the uniform list and not the attribute itself
                    var attribute = attributeStack.globalDefault;
                    if ( attribute.getOrCreateUniforms === undefined ) {
                        continue;
                    }
                    var uniformMap = attribute.getOrCreateUniforms();
                    var uniformMapKeys = uniformMap.getKeys();
                    var uniformMapContent = uniformMap.getMapContent();

                    for ( var a = 0, b = uniformMapKeys.length; a < b; a++ ) {
                        activeUniformsList.push( uniformMapContent[ uniformMapKeys[ a ] ] );
                    }
                }
            }
        },

        cacheUniformsForCustomProgram: function( program, activeUniformsList ) {

            this.getActiveUniformsFromProgramAttributes( program, activeUniformsList );

            this.getActiveUniformsFromProgramTextureAttributes( program, activeUniformsList );

            var gl = this._graphicContext;

            // now we have a list on uniforms we want to track but we will filter them to use only what is needed by our program
            // not that if you create a uniforms whith the same name of a tracked attribute, and it will override it
            var uniformsFinal = new Map();
            var uniformsFinalMap = uniformsFinal.getMapContent();
            for ( var i = 0, l = activeUniformsList.length; i < l; i++ ) {
                var u = activeUniformsList[ i ];
                var loc = gl.getUniformLocation( program.program, u.name );
                if ( loc !== undefined && loc !== null ) {
                    uniformsFinalMap[ u.name ] = u;
                }
            }
            uniformsFinal.dirty();
            program.trackUniforms = uniformsFinal;

        },

        applyCustomProgram: (function() {

            var activeUniformsList = [];

            return function( program ) {

                // custom program so we will iterate on uniform from the program and apply them
                // but in order to be able to use Attribute in the state graph we will check if
                // our program want them. It must be defined by the user
                var programUniforms = program.uniformsCache;

                // first time we see attributes key, so we will keep a list of uniforms from attributes
                activeUniformsList.length = 0;

                // fill the program with cached active uniforms map from attributes and texture attributes
                if ( program.trackAttributes !== undefined && program.trackUniforms === undefined ) {
                    this.cacheUniformsForCustomProgram( program, activeUniformsList );
                }

                var programUniformKeys = programUniforms.getKeys();
                var programUniformMap = programUniforms.getMapContent();
                var uniformMapStackContent = this.uniforms.getMapContent();

                var programTrackUniformMapContent;
                if ( program.trackUniforms )
                    programTrackUniformMapContent = program.trackUniforms.getMapContent();

                var uniform;
                for ( var i = 0, l = programUniformKeys.length; i < l; i++ ) {
                    var uniformKey = programUniformKeys[ i ];
                    var location = programUniformMap[ uniformKey ];
                    var uniformStack = uniformMapStackContent[ uniformKey ];

                    if ( uniformStack === undefined ) {

                        if ( programTrackUniformMapContent !== undefined ) {
                            uniform = programTrackUniformMapContent[ uniformKey ];
                            if ( uniform !== undefined ) {
                                uniform.apply( this._graphicContext, location );
                            }
                        }

                    } else {

                        if ( uniformStack.length === 0 ) {
                            uniform = uniformStack.globalDefault;
                        } else {
                            uniform = uniformStack.back().object;
                        }
                        uniform.apply( this._graphicContext, location );

                    }
                }
            };
        })(),

        applyAttributeMap: function ( attributeMap ) {
            var attributeStack;

            var attributeMapKeys = attributeMap.getKeys();
            var attributeMapContent = attributeMap.getMapContent();

            for ( var i = 0, l = attributeMapKeys.length; i < l; i++ ) {
                var key = attributeMapKeys[ i ];

                attributeStack = attributeMapContent[ key ];
                if ( attributeStack === undefined ) {
                    continue;
                }
                var attribute;
                if ( attributeStack.length === 0 ) {
                    attribute = attributeStack.globalDefault;
                } else {
                    attribute = attributeStack.back().object;
                }

                if ( attributeStack.asChanged ) {
                    //            if (attributeStack.lastApplied !== attribute || attribute.isDirty()) {
                    if ( attributeStack.lastApplied !== attribute ) {
                        if ( attribute.apply ) {
                            attribute.apply( this );
                        }
                        attributeStack.lastApplied = attribute;
                    }
                    attributeStack.asChanged = false;
                }
            }
        },

        getObjectPair: function ( uniform, value ) {
            return {
                object: uniform,
                value: value
            };
        },
        pushUniformsList: function ( uniformMap, stateSetUniformMap ) {
            /*jshint bitwise: false */
            var name;
            var uniform;

            var uniformMapContent = uniformMap.getMapContent();

            var stateSetUniformMapKeys = stateSetUniformMap.getKeys();
            var stateSetUniformMapContent = stateSetUniformMap.getMapContent();

            for ( var i = 0, l = stateSetUniformMapKeys.length; i < l; i++ ) {
                var key = stateSetUniformMapKeys[ i ];
                var uniformPair = stateSetUniformMapContent[ key ];
                uniform = uniformPair.getUniform();
                name = uniform.name;
                if ( uniformMapContent[ name ] === undefined ) {
                    uniformMapContent[ name ] = Stack.create();
                    uniformMapContent[ name ].globalDefault = uniform;
                    uniformMap.dirty();
                }
                var value = uniformPair.getValue();
                var stack = uniformMapContent[ name ];
                if ( stack.length === 0 ) {
                    stack.push( this.getObjectPair( uniform, value ) );
                } else if ( ( stack[ stack.length - 1 ].value & StateAttribute.OVERRIDE ) && !( value & StateAttribute.PROTECTED ) ) {
                    stack.push( stack[ stack.length - 1 ] );
                } else {
                    stack.push( this.getObjectPair( uniform, value ) );
                }
            }
            /*jshint bitwise: true */
        },
        popUniformsList: function ( uniformMap, stateSetUniformMap ) {

            var stateSetUniformMapKeys = stateSetUniformMap.getKeys();
            var uniformMapContent = uniformMap.getMapContent();

            for ( var i = 0, l = stateSetUniformMapKeys.length; i < l; i++ ) {
                var key = stateSetUniformMapKeys[ i ];
                uniformMapContent[ key ].pop();
            }
        },

        applyTextureAttributeMapList: function ( textureAttributesMapList ) {
            var gl = this._graphicContext;
            var textureAttributeMap;

            for ( var textureUnit = 0, l = textureAttributesMapList.length; textureUnit < l; textureUnit++ ) {
                textureAttributeMap = textureAttributesMapList[ textureUnit ];
                if ( textureAttributeMap === undefined ) {
                    continue;
                }


                var textureAttributeMapContent = textureAttributeMap.getMapContent();
                var textureAttributeMapKeys = textureAttributeMap.getKeys();

                for ( var i = 0, lt = textureAttributeMapKeys.length; i < lt; i++ ) {
                    var key = textureAttributeMapKeys[ i ];

                    var attributeStack = textureAttributeMapContent[ key ];
                    if ( attributeStack === undefined ) {
                        continue;
                    }

                    var attribute;
                    if ( attributeStack.length === 0 ) {
                        attribute = attributeStack.globalDefault;
                    } else {
                        attribute = attributeStack.back().object;
                    }
                    if ( attributeStack.asChanged ) {

                        gl.activeTexture( gl.TEXTURE0 + textureUnit );
                        attribute.apply( this, textureUnit );
                        attributeStack.lastApplied = attribute;
                        attributeStack.asChanged = false;

                    }
                }
            }
        },
        setGlobalDefaultValue: function ( attribute ) {

            var key = attribute.getTypeMember();
            var attributeMapContent = this.attributeMap.getMapContent();

            if ( attributeMapContent[ key ] ) {
                attributeMapContent[ key ].globalDefault = attribute;

            } else {
                attributeMapContent[ key ] = Stack.create();
                attributeMapContent[ key ].globalDefault = attribute;

                this.attributeMap.dirty();
            }
        },

        pushAttributeMap: function ( attributeMap, stateSetAttributeMap ) {
            /*jshint bitwise: false */
            var attributeStack;
            var attributeMapContent = attributeMap.getMapContent();

            var stateSetAttributeMapKeys = stateSetAttributeMap.getKeys();
            var stateSetAttributeMapContent = stateSetAttributeMap.getMapContent();

            for ( var i = 0, l = stateSetAttributeMapKeys.length; i < l; i++ ) {

                var type = stateSetAttributeMapKeys[ i ];
                var attributePair = stateSetAttributeMapContent[ type ];
                var attribute = attributePair.getAttribute();

                if ( attributeMapContent[ type ] === undefined ) {
                    attributeMapContent[ type ] = Stack.create();
                    attributeMapContent[ type ].globalDefault = attribute.cloneType();

                    attributeMap.dirty();
                }

                var value = attributePair.getValue();

                attributeStack = attributeMapContent[ type ];
                if ( attributeStack.length === 0 ) {
                    attributeStack.push( this.getObjectPair( attribute, value ) );
                } else if ( ( attributeStack[ attributeStack.length - 1 ].value & StateAttribute.OVERRIDE ) && !( value & StateAttribute.PROTECTED ) ) {
                    attributeStack.push( attributeStack[ attributeStack.length - 1 ] );
                } else {
                    attributeStack.push( this.getObjectPair( attribute, value ) );
                }

                attributeStack.asChanged = true;
            }
            /*jshint bitwise: true */
        },

        popAttributeMap: function ( attributeMap, stateSetAttributeMap ) {

            var attributeStack;
            var stateSetAttributeMapKeys = stateSetAttributeMap.getKeys();
            var attributeMapContent = attributeMap.getMapContent();

            for ( var i = 0, l = stateSetAttributeMapKeys.length; i < l; i++ ) {

                var type = stateSetAttributeMapKeys[ i ];
                attributeStack = attributeMapContent[ type ];
                attributeStack.pop();
                attributeStack.asChanged = true;

            }
        },

        setIndexArray: function ( array ) {
            var gl = this._graphicContext;
            if ( this.currentIndexVBO !== array ) {
                array.bind( gl );
                this.currentIndexVBO = array;
            }
            if ( array.isDirty() ) {
                array.compile( gl );
            }
        },

        lazyDisablingOfVertexAttributes: function () {
            var keys = this.vertexAttribMap._keys;
            for ( var i = 0, l = keys.length; i < l; i++ ) {
                var attr = keys[ i ];
                if ( this.vertexAttribMap[ attr ] ) {
                    this.vertexAttribMap._disable[ attr ] = true;
                }
            }
        },

        applyDisablingOfVertexAttributes: function () {
            var keys = this.vertexAttribMap._keys;
            for ( var i = 0, l = keys.length; i < l; i++ ) {
                if ( this.vertexAttribMap._disable[ keys[ i ] ] === true ) {
                    var attr = keys[ i ];
                    this._graphicContext.disableVertexAttribArray( attr );
                    this.vertexAttribMap._disable[ attr ] = false;
                    this.vertexAttribMap[ attr ] = false;
                }
            }

            // it takes 4.26% of global cpu
            // there would be a way to cache it and track state if the program has not changed ...
            var program = this.programs.lastApplied;

            if ( program !== undefined ) {
                var gl = this.getGraphicContext();
                var attributeCacheMapContentColor = program.attributesCache.getMapContent().Color;
                var updateColorUniform = false;
                var hasColorAttrib = false;
                if ( attributeCacheMapContentColor !== undefined ) {
                    hasColorAttrib = this.vertexAttribMap[ attributeCacheMapContentColor ];
                }

                var uniform = this.uniforms.getMapContent().ArrayColorEnabled.globalDefault;
                if ( this.previousHasColorAttrib !== hasColorAttrib ) {
                    updateColorUniform = true;
                }

                this.previousHasColorAttrib = hasColorAttrib;

                if ( updateColorUniform ) {
                    if ( hasColorAttrib ) {
                        uniform.get()[ 0 ] = 1.0;
                    } else {
                        uniform.get()[ 0 ] = 0.0;
                    }
                    uniform.dirty();
                }

                uniform.apply( gl, program.uniformsCache.getMapContent().ArrayColorEnabled );
            }
        },
        setVertexAttribArray: function ( attrib, array, normalize ) {
            var vertexAttribMap = this.vertexAttribMap;
            vertexAttribMap._disable[ attrib ] = false;
            var gl = this._graphicContext;
            var binded = false;
            if ( array.isDirty() ) {
                array.bind( gl );
                array.compile( gl );
                binded = true;
            }

            if ( vertexAttribMap[ attrib ] !== array ) {

                if ( !binded ) {
                    array.bind( gl );
                }

                if ( !vertexAttribMap[ attrib ] ) {
                    gl.enableVertexAttribArray( attrib );

                    if ( vertexAttribMap[ attrib ] === undefined ) {
                        vertexAttribMap._keys.push( attrib );
                    }
                }

                vertexAttribMap[ attrib ] = array;
                gl.vertexAttribPointer( attrib, array._itemSize, gl.FLOAT, normalize, 0, 0 );
            }
        }

    };

    return State;
} );

define( 'Q',[],function ( ) {
    if ( window.Q ) {
        return window.Q;
    }
    return window.require( 'Q' );
} );

define( 'osg/TextureManager',[
    'osg/Notify'

], function ( Notify ) {

    var TextureProfile = function( target, internalFormat, width, height ) {
        this._target = target;
        this._internalFormat = internalFormat;
        this._width = width;
        this._height = height;
        this._size = 0;
        this.computeSize();
    };

    TextureProfile.prototype = {
        match: function( textureProfile ) {
            return textureProfile._target === this._target &&
                textureProfile._internalFormat === this._internalFormat &&
                textureProfile._width === this._width &&
                textureProfile._height === this._height;
        },
        computeSize: function() {
            var Texture = require( 'osg/Texture' );

            var numBitsPerTexel = 0;
            switch( this._internalFormat) {
            case(1): numBitsPerTexel = 8; break;
            case(Texture.ALPHA): numBitsPerTexel = 8; break;
            case(Texture.LUMINANCE): numBitsPerTexel = 8; break;

            case(Texture.LUMINANCE_ALPHA): numBitsPerTexel = 16; break;
            case(2): numBitsPerTexel = 16; break;

            case(Texture.RGB): numBitsPerTexel = 24; break;
            case(3): numBitsPerTexel = 24; break;

            case(Texture.RGBA): numBitsPerTexel = 32; break;
            case(4): numBitsPerTexel = 32; break;

            }
            this._size = (Math.ceil( this._width * this._height * numBitsPerTexel)/8.0);
        },

        getSize: function() { return this._size; }

    };
    TextureProfile.getHash = function() {
        var array = Array.prototype.slice.call( arguments );
        var hash = '';
        array.forEach( function( element ) {
            hash += element;
        });
        return hash;
    };


    var TextureObject = function( texture, id, textureSet ) {
        this._texture = texture;
        this._id = id;
        this._textureSet = textureSet;
    };

    TextureObject.prototype = {
        target: function() { return this._textureSet._profile._target; },
        id: function() { return this._id; },
        getTextureSet: function() {
            return this._textureSet;
        },
        reset: function() {
            this._textureObject = null;
            this._texture = undefined;
        },
        bind: function( gl ) {
            gl.bindTexture( this.target(), this._id );
        }
    };

    var TextureObjectSet = function( profile ) {
        this._profile = profile;
        this._usedTextureObjects = [];
        this._orphanedTextureObjects = [];
    };

    TextureObjectSet.prototype = {
        getProfile: function() { return this._profile; },
        getUsedTextureObjects: function() { return this._usedTextureObjects; },
        getOrphanedTextureObjects: function() { return this._orphanedTextureObjects; },
        takeOrGenerate: function( gl, texture ) {

            var textureObject;
            if ( this._orphanedTextureObjects.length > 0 ) {
                textureObject = this.takeFromOrphans();
                textureObject.setTexture( texture );
                this._usedTextureObjects.push( textureObject );
                return textureObject;
            }

            var textureID = gl.createTexture();
            textureObject = new TextureObject( texture, textureID, this );
            this._usedTextureObjects.push( textureObject );

            return textureObject;
        },

        // get texture object from pool
        takeFromOrphans: function() {
            if ( this._orphanedTextureObjects.length ) {
                var textureObject = this._orphanedTextureObjects.pop();
                this._usedTextureObjects.push( textureObject );
                return textureObject;
            }
            return undefined;
        },

        // release texture object
        orphan: function( textureObject ) {
            var index = this._usedTextureObjects.indexOf( textureObject );
            if ( index > -1 ) {
                this._orphanedTextureObjects.push( this._usedTextureObjects[ index ] );
                this._usedTextureObjects.splice( index, 1 );
            }
        },
        flushAllDeletedTextureObjects: function( gl ) {
            var nbTextures = this._orphanedTextureObjects.length;
            var size = this.getProfile().getSize();
            this._orphanedTextureObjects.forEach( function( textureObject ) {
                gl.deleteTexture( textureObject.id() );
                textureObject.reset();
            });
            this._orphanedTextureObjects.length = 0;
            Notify.info( 'TextureManager: released ' + nbTextures + ' with ' + (nbTextures*size/(1024*1024)) + ' MB' );
        }
    };


    var TextureManager = function() {
        this._textureSetMap = {};
    };

    TextureManager.prototype = {

        generateTextureObject: function( gl,
                                         texture,
                                         target,
                                         internalFormat,
                                         width,
                                         height )
        {
            var hash = TextureProfile.getHash( target, internalFormat, width, height );

            if ( this._textureSetMap[ hash ] === undefined ) {
                 this._textureSetMap[ hash ] = new TextureObjectSet( new TextureProfile( target, internalFormat, width, height ) );
            }

            var textureSet = this._textureSetMap[ hash ];
            var textureObject = textureSet.takeOrGenerate( gl, texture );
            return textureObject;
        },
        reportStats: function() {
            var total = 0;
            Object.keys( this._textureSetMap ).forEach( function( key ) {
                var profile = this._textureSetMap[ key ].getProfile();
                var size = profile.getSize() / ( 1024 * 1024 );
                var nb = this._textureSetMap[ key ].getUsedTextureObjects().length;
                size *= nb;
                total += size ;
                Notify.notice( ''+ size + ' MB with ' + nb + ' texture of ' + profile._width +'x' + profile._height + ' ' + profile._internalFormat);
            }, this );
            Notify.notice( ''+ total + ' MB in total');

        },

        flushAllDeletedTextureObjects: function( gl ) {
            Object.keys( this._textureSetMap ).forEach( function( key ) {
                this._textureSetMap[ key ].flushAllDeletedTextureObjects( gl );
            }, this );
        },

        releaseTextureObject: function( textureObject ) {
            if ( textureObject ) {
                var ts = textureObject.getTextureSet();
                ts.orphan( textureObject );
            }
        }

    };

    return TextureManager;

});

define( 'osgDB/Options',[
], function( ) {

    var defaultOptions = {

        // prefix to built url to load resource
        prefixURL: '',

        // callback used when loading data
        progressXHRCallback: undefined,

        // replacement of readImageURL to use your own code to load osg.Image
        // the function will be execute in the context of Input, see Input:readImageURL
        readImageURL: undefined,

        // replacement of readBinaryArrayURL to use your own code to load binary array
        // the function will be execute in the context of Input, see Input:readBinaryArrayURL
        readBinaryArrayURL: undefined,

        imageLoadingUsePromise: true, // use promise to load image instead of returning Image
        imageOnload: undefined, // use callback when loading an image
        imageCrossOrigin: undefined // use callback when loading an image
    };

    return defaultOptions;

});

define( 'osgDB/Input',[
    'Q',
    'require',
    'osg/Utils',
    'osgNameSpace',
    'osgDB/ReaderParser',
    'osgDB/Options',
    'osg/Notify',
    'osg/Image',
    'osg/BufferArray',
    'osg/DrawArrays',
    'osg/DrawArrayLengths',
    'osg/DrawElements',
    'osg/PrimitiveSet'
], function ( Q, require, MACROUTILS, osgNameSpace, ReaderParser, Options, Notify, Image, BufferArray, DrawArrays, DrawArrayLengths, DrawElements, PrimitiveSet ) {

    var Input = function ( json, identifier ) {
        this._json = json;
        var map = identifier;
        if ( map === undefined ) {
            map = {};
        }
        this._identifierMap = map;
        this._objectRegistry = {};
        // this._progressXHRCallback = undefined;
        // this._prefixURL = '';
        // this.setImageLoadingOptions( {
        //     promise: true,
        //     onload: undefined
        // } );

        this.setOptions ( MACROUTILS.objectMix( {}, Options) );

        // {
        //     prefixURL: '',
        //     progressXHRCallback: undefined,
        //     readImageURL: undefined,
        //     imageLoadingUsePromise: undefined,
        //     imageOnload: undefined,
        // };
    };


    // keep one instance of image fallback
    if ( !Input.imageFallback ) {
        Input.imageFallback = ( function () {
            var fallback = new window.Image();
            fallback.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIW2P8DwQACgAD/il4QJ8AAAAASUVORK5CYII=';
            return fallback;
        } )();
    }

    Input.prototype = {

        setOptions: function ( options ) {
            this._defaultOptions = options;
        },
        getOptions: function () {
            return this._defaultOptions;
        },
        setProgressXHRCallback: function ( func ) {
            this._defaultOptions.progressXHRCallback = func;
        },

        // used to override the type from pathname
        // typically if you want to create proxy object
        registerObject: function ( fullyQualifiedObjectname, constructor ) {
            this._objectRegistry[ fullyQualifiedObjectname ] = constructor;
        },

        getJSON: function () {
            return this._json;
        },

        setJSON: function ( json ) {
            this._json = json;
            return this;
        },

        setPrefixURL: function ( prefix ) {
            this._defaultOptions.prefixURL = prefix;
        },
        getPrefixURL: function () {
            return this._defaultOptions.prefixURL;
        },
        computeURL: function ( url ) {
            if ( this._defaultOptions.prefixURL === undefined ) {
                return url;
            }
            return this._defaultOptions.prefixURL + url;
        },
        getObjectWrapper: function ( path ) {
            if ( this._objectRegistry[ path ] !== undefined ) {
                return new( this._objectRegistry[ path ] )();
            }

            var scope = osgNameSpace;
            var splittedPath = path.split( '.' );
            for ( var i = 0, l = splittedPath.length; i < l; i++ ) {
                var obj = scope[ splittedPath[ i ] ];
                if ( obj === undefined ) {
                    return undefined;
                }
                scope = obj;
            }
            var ClassName = scope;
            // create the new obj
            return new( ClassName )();
        },

        fetchImage: function ( image, url, options, defer ) {
            var checkInlineImage = 'data:image/';
            // crossOrigin does not work for inline data image
            var isInlineImage = ( url.substring( 0, checkInlineImage.length ) === checkInlineImage );
            var img = new window.Image();
            img.onerror = function () {
                Notify.warn( 'warning use white texture as fallback instead of ' + url );
                image.setImage( Input.imageFallback );
                if ( defer ) {
                    defer.resolve( image );
                }
            };

            if ( !isInlineImage && options.imageCrossOrigin ) {
                img.crossOrigin = options.imageCrossOrigin;
            }

            img.onload = function () {

                if ( defer ) {
                    if ( options.imageOnload ) options.imageOnload.call( image );
                    defer.resolve( image );
                } else if ( options.imageOnload )
                    options.imageOnload.call( image );

            };

            image.setURL( url );
            image.setImage( img );

            img.src = url;
            return image;
        },

        readImageURL: function ( url, options ) {

            if ( options === undefined ) {
                options = this._defaultOptions;
            }

            // hook reader
            if ( options.readImageURL ) {
                // be carefull if you plan to call hook the call and after
                // call the original readImageURL, you will need to remove
                // from options the readImageURL if you dont want an infinte
                // recursion call
                return options.readImageURL.call(this, url, options );
            }

            // if image is on inline image skip url computation
            if ( url.substr( 0, 10 ) !== 'data:image' ) {
                url = this.computeURL( url );
            }


            var image = new Image();
            if ( options.imageLoadingUsePromise !== true ) {
                return this.fetchImage( image, url, options );
            }

            var defer = Q.defer();
            this.fetchImage( image, url, options, defer );

            return defer.promise;
        },


        readNodeURL: function ( url, options ) {
            url = this.computeURL( url );

            var defer = Q.defer();

            options = options || {};
            var opt = MACROUTILS.objectMix( {}, options );

            // automatic prefix if non specfied
            if ( opt.prefixURL === undefined ) {
                var prefix = this.getPrefixURL();
                var index = url.lastIndexOf( '/' );
                if ( index !== -1 ) {
                    prefix = url.substring( 0, index + 1 );
                }
                opt.prefixURL = prefix;
            }

            var req = new XMLHttpRequest();
            req.open( 'GET', url, true );
            req.onreadystatechange = function ( /*aEvt*/ ) {
                if ( req.readyState === 4 ) {
                    if ( req.status === 200 ) {
                        var ReaderParser = require( 'osgDB/ReaderParser' );
                        Q.when( ReaderParser.parseSceneGraph( JSON.parse( req.responseText ),
                                opt ),
                            function ( child ) {
                                defer.resolve( child );
                                Notify.log( 'loaded ' + url );

                            } ).fail( function ( error ) {
                            defer.reject( error );
                        } );
                    } else {
                        defer.reject( req.status );
                    }
                }
            };
            req.send( null );
            return defer.promise;
        },

        readBinaryArrayURL: function ( url, options ) {

            if ( options === undefined ) {
                options = this._defaultOptions;
            }

            if ( options.readBinaryArrayURL ) {
                return options.readBinaryArrayURL.call( this, url, options );
            }

            url = this.computeURL( url );


            if ( this._identifierMap[ url ] !== undefined ) {
                return this._identifierMap[ url ];
            }
            var defer = Q.defer();
            var xhr = new XMLHttpRequest();
            xhr.open( 'GET', url, true );
            xhr.responseType = 'arraybuffer';

            if ( this._defaultOptions.progressXHRCallback ) {
                xhr.addEventListener( 'progress', this._defaultOptions.progressXHRCallback, false );
            }

            xhr.addEventListener( 'error', function () {
                defer.reject();
            }, false );

            var self = this;
            xhr.addEventListener( 'load', function ( /*oEvent */ ) {
                var arrayBuffer = xhr.response; // Note: not oReq.responseText
                if ( arrayBuffer ) {
                    // var byteArray = new Uint8Array(arrayBuffer);
                    self._identifierMap[ url ] = arrayBuffer;
                    defer.resolve( arrayBuffer );
                } else {
                    defer.reject();
                }
            }, false );

            xhr.send( null );
            this._identifierMap[ url ] = defer.promise;
            return defer.promise;
        },

        readBufferArray: function () {
            var jsonObj = this.getJSON();

            var uniqueID = jsonObj.UniqueID;
            var osgjsObject;
            if ( uniqueID !== undefined ) {
                osgjsObject = this._identifierMap[ uniqueID ];
                if ( osgjsObject !== undefined ) {
                    return osgjsObject;
                }
            }

            var check = function ( o ) {
                if ( ( o.Elements !== undefined || o.Array !== undefined ) &&
                    o.ItemSize !== undefined &&
                    o.Type ) {
                    return true;
                }
                return false;
            };

            if ( !check( jsonObj ) ) {
                return undefined;
            }

            var obj, defer;

            // inline array
            if ( jsonObj.Elements !== undefined ) {
                obj = new BufferArray( BufferArray[ jsonObj.Type ], jsonObj.Elements, jsonObj.ItemSize );

            } else if ( jsonObj.Array !== undefined ) {

                var buf = new BufferArray( BufferArray[ jsonObj.Type ] );
                buf.setItemSize( jsonObj.ItemSize );

                var vb, type;
                if ( jsonObj.Array.Float32Array !== undefined ) {
                    vb = jsonObj.Array.Float32Array;
                    type = 'Float32Array';
                } else if ( jsonObj.Array.Uint16Array !== undefined ) {
                    vb = jsonObj.Array.Uint16Array;
                    type = 'Uint16Array';
                } else {
                    Notify.warn( 'Typed Array ' + window.Object.keys( jsonObj.Array )[ 0 ] );
                    type = 'Float32Array';
                }

                if ( vb !== undefined ) {
                    if ( vb.File !== undefined ) {
                        var url = vb.File;

                        defer = Q.defer();
                        Q.when( this.readBinaryArrayURL( url ) ).then( function ( array ) {

                            var typedArray;
                            // manage endianness
                            var bigEndian;
                            ( function () {
                                var a = new Uint8Array( [ 0x12, 0x34 ] );
                                var b = new Uint16Array( a.buffer );
                                bigEndian = ( ( b[ 0 ] ).toString( 16 ) === '1234' );
                            } )();

                            var offset = 0;
                            if ( vb.Offset !== undefined ) {
                                offset = vb.Offset;
                            }

                            var bytesPerElement = MACROUTILS[ type ].BYTES_PER_ELEMENT;
                            var nbItems = vb.Size;
                            var nbCoords = buf.getItemSize();
                            var totalSizeInBytes = nbItems * bytesPerElement * nbCoords;

                            if ( bigEndian ) {
                                Notify.log( 'big endian detected' );
                                var TypedArray = MACROUTILS[ type ];
                                var tmpArray = new TypedArray( nbItems * nbCoords );
                                var data = new DataView( array, offset, totalSizeInBytes );
                                var i = 0,
                                    l = tmpArray.length;
                                if ( type === 'Uint16Array' ) {
                                    for ( ; i < l; i++ ) {
                                        tmpArray[ i ] = data.getUint16( i * bytesPerElement, true );
                                    }
                                } else if ( type === 'Float32Array' ) {
                                    for ( ; i < l; i++ ) {
                                        tmpArray[ i ] = data.getFloat32( i * bytesPerElement, true );
                                    }
                                }
                                typedArray = tmpArray;
                                data = null;
                            } else {
                                typedArray = new MACROUTILS[ type ]( array, offset, nbCoords * nbItems );
                            }

                            buf.setElements( typedArray );
                            defer.resolve( buf );
                        } );
                    } else if ( vb.Elements !== undefined ) {
                        var elements = new MACROUTILS[ type ]( vb.Elements );
                        buf.setElements( elements );
                    }
                }
                obj = buf;
            }

            if ( uniqueID !== undefined ) {
                this._identifierMap[ uniqueID ] = obj;
            }

            if ( defer !== undefined ) {
                return defer.promise;
            }
            return obj;
        },

        readUserDataContainer: function () {
            var jsonObj = this.getJSON();
            var osgjsObject;
            var uniqueID = jsonObj.UniqueID;
            if ( uniqueID !== undefined ) {
                osgjsObject = this._identifierMap[ uniqueID ];
                if ( osgjsObject !== undefined ) {
                    return osgjsObject.Values;
                }
            }

            this._identifierMap[ uniqueID ] = jsonObj;
            return jsonObj.Values;
        },

        readPrimitiveSet: function () {
            var jsonObj = this.getJSON();
            var uniqueID;
            var osgjsObject;

            var obj;
            var defer;
            var mode;
            var first, count;
            var drawElementPrimitive = jsonObj.DrawElementUShort || jsonObj.DrawElementUByte || jsonObj.DrawElementUInt || jsonObj.DrawElementsUShort || jsonObj.DrawElementsUByte || jsonObj.DrawElementsUInt || undefined;
            if ( drawElementPrimitive ) {

                uniqueID = drawElementPrimitive.UniqueID;
                if ( uniqueID !== undefined ) {
                    osgjsObject = this._identifierMap[ uniqueID ];
                    if ( osgjsObject !== undefined ) {
                        return osgjsObject;
                    }
                }

                defer = Q.defer();
                var jsonArray = drawElementPrimitive.Indices;
                var prevJson = jsonObj;

                mode = drawElementPrimitive.Mode;
                if ( !mode ) {
                    mode = PrimitiveSet.TRIANGLES;
                } else {
                    mode = PrimitiveSet[ mode ];
                }
                obj = new DrawElements( mode );

                this.setJSON( jsonArray );
                Q.when( this.readBufferArray() ).then(
                    function ( array ) {
                        obj.setIndices( array );
                        defer.resolve( obj );
                    } );
                this.setJSON( prevJson );
            }

            var drawArrayPrimitive = jsonObj.DrawArray || jsonObj.DrawArrays;
            if ( drawArrayPrimitive ) {

                uniqueID = drawArrayPrimitive.UniqueID;
                if ( uniqueID !== undefined ) {
                    osgjsObject = this._identifierMap[ uniqueID ];
                    if ( osgjsObject !== undefined ) {
                        return osgjsObject;
                    }
                }

                mode = drawArrayPrimitive.Mode || drawArrayPrimitive.mode;
                first = drawArrayPrimitive.First !== undefined ? drawArrayPrimitive.First : drawArrayPrimitive.first;
                count = drawArrayPrimitive.Count !== undefined ? drawArrayPrimitive.Count : drawArrayPrimitive.count;
                var drawArray = new DrawArrays( PrimitiveSet[ mode ], first, count );
                obj = drawArray;
            }

            var drawArrayLengthsPrimitive = jsonObj.DrawArrayLengths || undefined;
            if ( drawArrayLengthsPrimitive ) {

                uniqueID = drawArrayLengthsPrimitive.UniqueID;
                if ( uniqueID !== undefined ) {
                    osgjsObject = this._identifierMap[ uniqueID ];
                    if ( osgjsObject !== undefined ) {
                        return osgjsObject;
                    }
                }

                mode = drawArrayLengthsPrimitive.Mode;
                first = drawArrayLengthsPrimitive.First;
                var array = drawArrayLengthsPrimitive.ArrayLengths;
                var drawArrayLengths = new DrawArrayLengths( PrimitiveSet[ mode ], first, array );
                obj = drawArrayLengths;
            }

            if ( uniqueID !== undefined ) {
                this._identifierMap[ uniqueID ] = obj;
            }

            if ( defer ) {
                return defer.promise;
            }
            return obj;
        },


        readObject: function () {

            var jsonObj = this.getJSON();
            var prop = window.Object.keys( jsonObj )[ 0 ];
            if ( !prop ) {
                Notify.warn( 'can\'t find property for object ' + jsonObj );
                return undefined;
            }

            var uniqueID = jsonObj[ prop ].UniqueID;
            var osgjsObject;
            if ( uniqueID !== undefined ) {
                osgjsObject = this._identifierMap[ uniqueID ];
                if ( osgjsObject !== undefined ) {
                    return osgjsObject;
                }
            }

            var obj = this.getObjectWrapper( prop );
            if ( !obj ) {
                Notify.warn( 'can\'t instanciate object ' + prop );
                return undefined;
            }
            var ReaderParser = require( 'osgDB/ReaderParser' );
            var scope = ReaderParser.ObjectWrapper.serializers;
            var splittedPath = prop.split( '.' );
            for ( var i = 0, l = splittedPath.length; i < l; i++ ) {
                var reader = scope[ splittedPath[ i ] ];
                if ( reader === undefined ) {
                    Notify.warn( 'can\'t find function to read object ' + prop + ' - undefined' );
                    return undefined;
                }
                scope = reader;
            }

            var promise = scope( this.setJSON( jsonObj[ prop ] ), obj );

            if ( uniqueID !== undefined ) {
                this._identifierMap[ uniqueID ] = obj;
                obj._uniqueID = uniqueID;
            }
            return promise;
        }
    };

    return Input;
} );

define( 'osgDB/ReaderParser',[
    'Q',
    'require',
    'osgDB/Input',
    'osg/Notify',
    'osg/Utils',
    'osg/Texture',
    'osg/Uniform',
    'osg/BlendFunc',
    'osg/Material',
    'osg/Geometry',
    'osg/BufferArray',
    'osg/PrimitiveSet',
    'osg/DrawArrays',
    'osg/DrawElements',
    'osg/StateSet',
    'osg/Node',
    'osg/Matrix',
    'osg/MatrixTransform',
    'osg/Projection'
], function ( Q, require, Input, Notify, MACROUTILS, Texture, Uniform, BlendFunc, Material, Geometry, BufferArray, PrimitiveSet, DrawArrays, DrawElements, StateSet, Node, Matrix, MatrixTransform, Projection ) {

    var ReaderParser = {};

    ReaderParser.ObjectWrapper = {};
    ReaderParser.ObjectWrapper.serializers = {};

    ReaderParser.readImage = function ( url, options ) {
        return ReaderParser.registry().readImageURL( url, options );
    };
    ReaderParser.readImageURL = ReaderParser.readImage; // alias

    ReaderParser.readNodeURL = function ( url, options ) {
        return ReaderParser.registry().readNodeURL( url, options );
    };

    ReaderParser.registry = function () {
        var Input = require( 'osgDB/Input' );
        if ( ReaderParser.registry._input === undefined ) {
            ReaderParser.registry._input = new Input();
        }
        return ReaderParser.registry._input;
    };

    ReaderParser.parseSceneGraph = function ( node, options ) {
        if ( node.Version !== undefined && node.Version > 0 ) {
            MACROUTILS.time('osgjs.metric:ReaderParser.parseSceneGraph');

            var getPropertyValue = function ( o ) {
                var props = window.Object.keys( o );
                for ( var i = 0, l = props.length; i < l; i++ ) {
                    if ( props[ i ] !== 'Generator' && props[ i ] !== 'Version' ) {
                        return props[ i ];
                    }
                }
                return undefined;
            };

            var key = getPropertyValue( node );
            if ( key ) {
                var obj = {};
                obj[ key ] = node[ key ];
                var Input = require( 'osgDB/Input' );
                var input = new Input( obj );

                // copy global options and override with user options
                var opt = MACROUTILS.objectMix( MACROUTILS.objectMix( {}, ReaderParser.registry().getOptions() ), options || {} );
                input.setOptions( opt );
                var object = input.readObject();
                MACROUTILS.timeEnd('osgjs.metric:ReaderParser.parseSceneGraph');
                return object;
            } else {
                Notify.log( 'can\'t parse scenegraph ' + node );
            }
        } else {
            MACROUTILS.time('osgjs.metric:ReaderParser.parseSceneGraphDeprecated');
            var nodeOld = ReaderParser.parseSceneGraphDeprecated( node );
            MACROUTILS.timeEnd('osgjs.metric:ReaderParser.parseSceneGraphDeprecated');
            return nodeOld;
        }
        return undefined;
    };

    ReaderParser.parseSceneGraphDeprecated = function ( node ) {
        var getFieldBackwardCompatible = function ( field, json ) {
            var value = json[ field ];
            if ( value === undefined ) {
                value = json[ field.toLowerCase() ];
            }
            return value;
        };
        var setName = function ( osgjs, json ) {
            var name = getFieldBackwardCompatible( 'Name', json );
            if ( name && osgjs.setName !== undefined ) {
                osgjs.setName( name );
            }
        };

        var setMaterial = function ( osgjs, json ) {
            setName( osgjs, json );
            osgjs.setAmbient( getFieldBackwardCompatible( 'Ambient', json ) );
            osgjs.setDiffuse( getFieldBackwardCompatible( 'Diffuse', json ) );
            osgjs.setEmission( getFieldBackwardCompatible( 'Emission', json ) );
            osgjs.setSpecular( getFieldBackwardCompatible( 'Specular', json ) );
            osgjs.setShininess( getFieldBackwardCompatible( 'Shininess', json ) );
        };

        var setBlendFunc = function ( osgjs, json ) {
            setName( osgjs, json );
            osgjs.setSourceRGB( json.SourceRGB );
            osgjs.setSourceAlpha( json.SourceAlpha );
            osgjs.setDestinationRGB( json.DestinationRGB );
            osgjs.setDestinationAlpha( json.DestinationAlpha );
        };

        var setTexture = function ( osgjs, json ) {
            var magFilter = json.MagFilter || json['mag_filter'] || undefined;
            if ( magFilter ) {
                osgjs.setMagFilter( magFilter );
            }
            var minFilter = json.MinFilter || json['min_filter'] || undefined;
            if ( minFilter ) {
                osgjs.setMinFilter( minFilter );
            }
            var wrapT = json.WrapT || json['wrap_t'] || undefined;
            if ( wrapT ) {
                osgjs.setWrapT( wrapT );
            }
            var wrapS = json.WrapS || json['wrap_s'] || undefined;
            if ( wrapS ) {
                osgjs.setWrapS( wrapS );
            }
            var file = getFieldBackwardCompatible( 'File', json );
            Q.when( ReaderParser.readImage( file ) ).then(
                function ( img ) {
                    osgjs.setImage( img );
                } );
        };

        var setStateSet = function ( osgjs, json ) {
            setName( osgjs, json );
            var textures = getFieldBackwardCompatible( 'Textures', json ) || getFieldBackwardCompatible( 'TextureAttributeList', json ) || undefined;
            if ( textures ) {
                for ( var t = 0, tl = textures.length; t < tl; t++ ) {
                    var file = getFieldBackwardCompatible( 'File', textures[ t ] );
                    if ( !file ) {
                        Notify.log( 'no texture on unit ' + t + ' skip it' );
                        continue;
                    }
                    var Texture = require( 'osg/Texture' );
                    var tex = new Texture();
                    setTexture( tex, textures[ t ] );

                    osgjs.setTextureAttributeAndMode( t, tex );
                    osgjs.addUniform( Uniform.createInt1( t, 'Texture' + t ) );
                }
            }

            var blendfunc = getFieldBackwardCompatible( 'BlendFunc', json );
            if ( blendfunc ) {
                var newblendfunc = new BlendFunc();
                setBlendFunc( newblendfunc, blendfunc );
                osgjs.setAttributeAndMode( newblendfunc );
            }

            var material = getFieldBackwardCompatible( 'Material', json );
            if ( material ) {
                var newmaterial = new Material();
                setMaterial( newmaterial, material );
                osgjs.setAttributeAndMode( newmaterial );
            }
        };


        var newnode;
        var children = node.children;
        var primitives = node.primitives || node.Primitives || undefined;
        var attributes = node.attributes || node.Attributes || undefined;
        if ( primitives || attributes ) {
            newnode = new Geometry();

            setName( newnode, node );

            MACROUTILS.extend( newnode, node ); // we should not do that
            node = newnode;
            node.primitives = primitives; // we should not do that
            node.attributes = attributes; // we should not do that

            for ( var p = 0, lp = primitives.length; p < lp; p++ ) {
                var mode = primitives[ p ].mode;
                if ( primitives[ p ].indices ) {
                    var array = primitives[ p ].indices;
                    array = new BufferArray( BufferArray[ array.type ], array.elements, array.itemSize );
                    if ( !mode ) {
                        mode = 'TRIANGLES';
                    } else {
                        mode = PrimitiveSet[ mode ];
                    }
                    primitives[ p ] = new DrawElements( mode, array );
                } else {
                    mode = PrimitiveSet[ mode ];
                    var first = primitives[ p ].first;
                    var count = primitives[ p ].count;
                    primitives[ p ] = new DrawArrays( mode, first, count );
                }
            }

            for ( var key in attributes ) {
                if ( attributes.hasOwnProperty( key ) ) {
                    var attributeArray = attributes[ key ];
                    attributes[ key ] = new BufferArray( attributeArray.type, attributeArray.elements, attributeArray.itemSize );
                }
            }
        }

        var stateset = getFieldBackwardCompatible( 'StateSet', node );
        if ( stateset ) {
            var newstateset = new StateSet();
            setStateSet( newstateset, stateset );
            node.stateset = newstateset;
        }

        var matrix = node.matrix || node.Matrix || undefined;
        if ( matrix ) {
            newnode = new MatrixTransform();
            setName( newnode, node );

            MACROUTILS.extend( newnode, node );
            Matrix.copy( matrix, newnode.getMatrix() );
            node = newnode;
        }

        var projection = node.projection || node.Projection || undefined;
        if ( projection ) {
            newnode = new Projection();
            setName( newnode, node );
            MACROUTILS.extend( newnode, node );
            Matrix.copy( projection, newnode.setProjectionMatrix() );
            node = newnode;
        }

        // default type
        if ( node.typeID === undefined ) {
            newnode = new Node();
            setName( newnode, node );
            MACROUTILS.extend( newnode, node );
            node = newnode;
        }


        if ( children ) {
            // disable children, it will be processed in the end
            node.children = [];

            for ( var child = 0, childLength = children.length; child < childLength; child++ ) {
                node.addChild( ReaderParser.parseSceneGraphDeprecated( children[ child ] ) );
            }
        }

        return node;
    };

    return ReaderParser;
} );

define( 'osg/Texture',[
    'Q',
    'osg/Notify',
    'osg/Utils',
    'osg/TextureManager',
    'osg/StateAttribute',
    'osg/Uniform',
    'osg/Image',
    'osg/ShaderGenerator',
    'osgDB/ReaderParser',
    'osg/Map'
], function ( Q, Notify, MACROUTILS, TextureManager, StateAttribute, Uniform, Image, ShaderGenerator, ReaderParser, Map ) {

    // helper
    var isPowerOf2 = function ( x ) {
        /*jshint bitwise: false */
        return ( ( x !== 0 ) && ( ( x & ( ~x + 1 ) ) === x ) );
        /*jshint bitwise: true */
    };


    /**
     * Texture encapsulate webgl texture object
     * @class Texture
     * @inherits StateAttribute
     */
    var Texture = function () {
        StateAttribute.call( this );
        this.setDefaultParameters();
        this._applyTexImage2DCallbacks = [];
    };
    Texture.DEPTH_COMPONENT = 0x1902;
    Texture.ALPHA = 0x1906;
    Texture.RGB = 0x1907;
    Texture.RGBA = 0x1908;
    Texture.LUMINANCE = 0x1909;
    Texture.LUMINANCE_ALPHA = 0x190A;

    // filter mode
    Texture.LINEAR = 0x2601;
    Texture.NEAREST = 0x2600;
    Texture.NEAREST_MIPMAP_NEAREST = 0x2700;
    Texture.LINEAR_MIPMAP_NEAREST = 0x2701;
    Texture.NEAREST_MIPMAP_LINEAR = 0x2702;
    Texture.LINEAR_MIPMAP_LINEAR = 0x2703;

    // wrap mode
    Texture.CLAMP_TO_EDGE = 0x812F;
    Texture.REPEAT = 0x2901;
    Texture.MIRRORED_REPEAT = 0x8370;

    // target
    Texture.TEXTURE_2D = 0x0DE1;
    Texture.TEXTURE_CUBE_MAP = 0x8513;
    Texture.TEXTURE_BINDING_CUBE_MAP = 0x8514;
    Texture.TEXTURE_CUBE_MAP_POSITIVE_X = 0x8515;
    Texture.TEXTURE_CUBE_MAP_NEGATIVE_X = 0x8516;
    Texture.TEXTURE_CUBE_MAP_POSITIVE_Y = 0x8517;
    Texture.TEXTURE_CUBE_MAP_NEGATIVE_Y = 0x8518;
    Texture.TEXTURE_CUBE_MAP_POSITIVE_Z = 0x8519;
    Texture.TEXTURE_CUBE_MAP_NEGATIVE_Z = 0x851A;
    Texture.MAX_CUBE_MAP_TEXTURE_SIZE = 0x851C;

    Texture.UNSIGNED_BYTE = 0x1401;
    Texture.FLOAT = 0x1406;

    Texture.textureManager = new TextureManager();

    /** @lends Texture.prototype */
    Texture.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( StateAttribute.prototype, {
        attributeType: 'Texture',
        cloneType: function () {
            var t = new Texture();
            t.defaultType = true;
            return t;
        },
        getType: function () {
            return this.attributeType;
        },
        getTypeMember: function () {
            return this.attributeType;
        },
        getOrCreateUniforms: function ( unit ) {
            if ( Texture.uniforms === undefined ) {
                Texture.uniforms = [];
            }
            if ( Texture.uniforms[ unit ] === undefined ) {
                var name = this.getType() + unit;
                var uniformMap = new Map();
                var uniform = Uniform.createInt1( unit, name );
                uniformMap.setMapContent( {
                    texture: uniform
                } );
                uniform.dirty();
                Texture.uniforms[ unit ] = uniformMap;
            }
            // uniform for an texture attribute should directly in Texture.uniforms[unit] and not in Texture.uniforms[unit][Texture0]
            return Texture.uniforms[ unit ];
        },
        setDefaultParameters: function () {
            this._image = undefined;
            this._magFilter = Texture.LINEAR;
            this._minFilter = Texture.LINEAR;
            this._wrapS = Texture.CLAMP_TO_EDGE;
            this._wrapT = Texture.CLAMP_TO_EDGE;
            this._textureWidth = 0;
            this._textureHeight = 0;
            this._unrefImageDataAfterApply = false;
            this._internalFormat = undefined;
            this._textureTarget = Texture.TEXTURE_2D;
            this._type = Texture.UNSIGNED_BYTE;
        },
        getTextureTarget: function () {
            return this._textureTarget;
        },
        getTextureObject: function () {
            return this._textureObject;
        },
        setTextureSize: function ( w, h ) {
            this._textureWidth = w;
            this._textureHeight = h;
        },
        init: function ( gl ) {
            if ( !this._textureObject ) {
                this._textureObject = Texture.textureManager.generateTextureObject( gl,
                                                                                    this,
                                                                                    this._textureTarget,
                                                                                    this._internalFormat,
                                                                                    this._textureWidth,
                                                                                    this._textureHeight );
                this.dirty();
            }
        },
        addApplyTexImage2DCallback: function ( callback ) {
            var index = this._applyTexImage2DCallbacks.indexOf( callback );
            if ( index < 0 ) {
                this._applyTexImage2DCallbacks.push( callback );
            }
        },
        removeApplyTexImage2DCallback: function ( callback ) {
            var index = this._applyTexImage2DCallbacks.indexOf( callback );
            if ( index >= 0 ) {
                this._applyTexImage2DCallbacks.splice( index, 1 );
            }
        },
        getWidth: function () {
            return this._textureWidth;
        },
        getHeight: function () {
            return this._textureHeight;
        },
        releaseGLObjects: function ( gl ) {

            if ( this._textureObject !== undefined && this._textureObject !== null ) {
                this._textureObject.releaseTextureObject( gl );
                this._textureObject = undefined;
                this._image = undefined;
            }
        },
        setWrapS: function ( value ) {
            if ( typeof ( value ) === 'string' ) {
                this._wrapS = Texture[ value ];
            } else {
                this._wrapS = value;
            }
        },
        setWrapT: function ( value ) {
            if ( typeof ( value ) === 'string' ) {
                this._wrapT = Texture[ value ];
            } else {
                this._wrapT = value;
            }
        },

        getWrapT: function () {
            return this._wrapT;
        },
        getWrapS: function () {
            return this._wrapS;
        },
        getMinFilter: function () {
            return this._minFilter;
        },
        getMagFilter: function () {
            return this._magFilter;
        },

        setMinFilter: function ( value ) {
            if ( typeof ( value ) === 'string' ) {
                this._minFilter = Texture[ value ];
            } else {
                this._minFilter = value;
            }
        },
        setMagFilter: function ( value ) {
            if ( typeof ( value ) === 'string' ) {
                this._magFilter = Texture[ value ];
            } else {
                this._magFilter = value;
            }
        },

        setImage: function ( img, imageFormat ) {

            var image = img;
            if ( img instanceof window.Image ||
                 img instanceof HTMLCanvasElement ||
                 img instanceof Uint8Array ) {
                     image = new Image( img );
                 }

            this._image = image;
            this.setImageFormat( imageFormat );
            this.dirty();
        },
        getImage: function () {
            return this._image;
        },
        setImageFormat: function ( imageFormat ) {
            if ( imageFormat ) {
                if ( typeof ( imageFormat ) === 'string' ) {
                    imageFormat = Texture[ imageFormat ];
                }
                this._imageFormat = imageFormat;
            } else {
                this._imageFormat = Texture.RGBA;
            }
        },
        setType: function ( value ) {
            if ( typeof ( value ) === 'string' ) {
                this._type = Texture[ value ];
            } else {
                this._type = value;
            }
        },
        setUnrefImageDataAfterApply: function ( bool ) {
            this._unrefImageDataAfterApply = bool;
        },
        setInternalFormat: function ( internalFormat ) {
            this._internalFormat = internalFormat;
        },
        getInternalFormat: function () {
            return this._internalFormat;
        },

        applyFilterParameter: function ( gl, target ) {

            var powerOfTwo = isPowerOf2( this._textureWidth ) && isPowerOf2( this._textureHeight );
            if ( !powerOfTwo ) {
                this.setWrapT( Texture.CLAMP_TO_EDGE );
                this.setWrapS( Texture.CLAMP_TO_EDGE );

                if ( this._minFilter === Texture.LINEAR_MIPMAP_LINEAR ||
                     this._minFilter === Texture.LINEAR_MIPMAP_NEAREST ) {
                         this.setMinFilter( Texture.LINEAR );
                     }
            }

            gl.texParameteri( target, gl.TEXTURE_MAG_FILTER, this._magFilter );
            gl.texParameteri( target, gl.TEXTURE_MIN_FILTER, this._minFilter );
            gl.texParameteri( target, gl.TEXTURE_WRAP_S, this._wrapS );
            gl.texParameteri( target, gl.TEXTURE_WRAP_T, this._wrapT );
        },

        generateMipmap: function ( gl, target ) {
            if ( this._minFilter === gl.NEAREST_MIPMAP_NEAREST ||
                 this._minFilter === gl.LINEAR_MIPMAP_NEAREST ||
                 this._minFilter === gl.NEAREST_MIPMAP_LINEAR ||
                 this._minFilter === gl.LINEAR_MIPMAP_LINEAR ) {
                     gl.generateMipmap( target );
                 }
        },
        applyTexImage2D: function ( gl ) {
            var args = Array.prototype.slice.call( arguments, 1 );
            MACROUTILS.timeStamp( 'osgjs.metrics:Texture.texImage2d' );
            gl.texImage2D.apply( gl, args );

            // call a callback when upload is done if there is one
            var numCallback = this._applyTexImage2DCallbacks.length;
            if ( numCallback > 0 ) {
                for ( var i = 0, l = numCallback; i < l; i++ ) {
                    this._applyTexImage2DCallbacks[ i ].call( this );
                }
            }
        },
        computeTextureFormat: function() {
            if ( !this._internalFormat ) {
                this._internalFormat = this._imageFormat || Texture.RGBA;
                this._imageFormat = this._internalFormat;
            } else {
                this._imageFormat = this._internalFormat;
            }

        },
        apply: function ( state ) {
            var gl = state.getGraphicContext();

            if ( this._textureObject !== undefined && !this.isDirty() ) {
                this._textureObject.bind( gl );
            } else if ( this.defaultType ) {
                gl.bindTexture( this._textureTarget, null );
            } else {
                var image = this._image;
                if ( image !== undefined ) {

                    // when data is ready we will upload it to the gpu
                    if ( image.isReady() ) {

                        // must be called before init
                        this.computeTextureFormat();

                        var imgWidth = image.getWidth() || this._textureWidth;
                        var imgHeight = image.getHeight() || this._textureHeight;

                        this.setTextureSize( imgWidth, imgHeight );

                        if ( !this._textureObject ) {
                            this.init( gl );
                        }

                        this.setDirty( false );
                        this._textureObject.bind( gl );

                        if ( image.isTypedArray() ) {
                            this.applyTexImage2D( gl,
                                                  this._textureTarget,
                                                  0,
                                                  this._internalFormat,
                                                  this._textureWidth,
                                                  this._textureHeight,
                                                  0,
                                                  this._internalFormat,
                                                  this._type,
                                                  this._image.getImage() );
                        } else {
                            this.applyTexImage2D( gl,
                                                  this._textureTarget,
                                                  0,
                                                  this._internalFormat,
                                                  this._internalFormat,
                                                  this._type,
                                                  image.getImage() );
                        }

                        this.applyFilterParameter( gl, this._textureTarget );
                        this.generateMipmap( gl, this._textureTarget );

                        if ( this._unrefImageDataAfterApply ) {
                            this._image = undefined;
                        }

                    } else {
                        gl.bindTexture( this._textureTarget, null );
                    }

                } else if ( this._textureHeight !== 0 && this._textureWidth !== 0 ) {

                    // must be called before init
                    this.computeTextureFormat();

                    if ( !this._textureObject ) {
                        this.init( gl );
                    }
                    this._textureObject.bind( gl );
                    this.applyTexImage2D( gl, this._textureTarget, 0, this._internalFormat, this._textureWidth, this._textureHeight, 0, this._internalFormat, this._type, null );

                    this.applyFilterParameter( gl, this._textureTarget );
                    this.generateMipmap( gl, this._textureTarget );
                    this.setDirty( false );
                }
            }
        },


        /**
         set the injection code that will be used in the shader generation
         for FragmentMain part we would write something like that
         @example
         var fragmentGenerator = function(unit) {
         var str = 'texColor' + unit + ' = texture2D( Texture' + unit + ', FragTexCoord' + unit + '.xy );\n';
         str += 'fragColor = fragColor * texColor' + unit + ';\n';
         };
         setShaderGeneratorFunction(fragmentGenerator, ShaderGenerator.Type.FragmentMain);

         */
        setShaderGeneratorFunction: function (
            /**Function*/
            injectionFunction,
            /**ShaderGenerator.Type*/
            mode ) {
                this[ mode ] = injectionFunction;
            },

        generateShader: function ( unit, type ) {
            if ( this[ type ] ) {
                return this[ type ].call( this, unit );
            }
            return '';
        }
    } ), 'osg', 'Texture' );

    Texture.prototype[ ShaderGenerator.Type.VertexInit ] = function ( unit ) {
        var str = 'attribute vec2 TexCoord' + unit + ';\n';
        str += 'varying vec2 FragTexCoord' + unit + ';\n';
        return str;
    };
    Texture.prototype[ ShaderGenerator.Type.VertexMain ] = function ( unit ) {
        return 'FragTexCoord' + unit + ' = TexCoord' + unit + ';\n';
    };
    Texture.prototype[ ShaderGenerator.Type.FragmentInit ] = function ( unit ) {
        var str = 'varying vec2 FragTexCoord' + unit + ';\n';
        str += 'uniform sampler2D Texture' + unit + ';\n';
        str += 'vec4 texColor' + unit + ';\n';
        return str;
    };
    Texture.prototype[ ShaderGenerator.Type.FragmentMain ] = function ( unit ) {
        var str = 'texColor' + unit + ' = texture2D( Texture' + unit + ', FragTexCoord' + unit + '.xy );\n';
        str += 'fragColor = fragColor * texColor' + unit + ';\n';
        return str;
    };


    Texture.createFromURL = function ( imageSource, format ) {
        var texture = new Texture();
        Q.when( ReaderParser.readImage( imageSource ) ).then(
            function ( img ) {
                texture.setImage( img, format );
            }
        );
        return texture;
    };

    Texture.createFromImage = function ( image, format ) {
        var a = new Texture();
        a.setImage( image, format );
        return a;
    };

    Texture.createFromCanvas = function ( canvas, format ) {
        return Texture.createFromImage( canvas, format );
    };

    Texture.create = function ( url ) {
        Notify.log( 'Texture.create is deprecated, use Texture.createFromURL instead' );
        return Texture.createFromURL( url );
    };

    return Texture;
} );

define( 'osg/TextureCubeMap',[
    'osg/Utils',
    'osg/Texture',
    'osg/Image',
    'osg/Utils'

], function ( MACROUTILS, Texture, Image ) {
    /**
     * TextureCubeMap
     * @class TextureCubeMap
     * @inherits Texture
     */
    var TextureCubeMap = function () {
        Texture.call( this );
        this._images = {};
    };

    /** @lends TextureCubeMap.prototype */
    TextureCubeMap.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( Texture.prototype, {
        setDefaultParameters: function () {
            Texture.prototype.setDefaultParameters.call( this );
            this._textureTarget = Texture.TEXTURE_CUBE_MAP;
        },
        cloneType: function () {
            var t = new TextureCubeMap();
            t.defaultType = true;
            return t;
        },
        setImage: function ( face, img, imageFormat ) {

            if ( typeof ( face ) === 'string' ) {
                face = Texture[ face ];
            }

            if ( this._images[ face ] === undefined ) {
                this._images[ face ] = {};
            }

            if ( typeof ( imageFormat ) === 'string' ) {
                imageFormat = Texture[ imageFormat ];
            }
            if ( imageFormat === undefined ) {
                imageFormat = Texture.RGBA;
            }

            var image = img;
            if ( image instanceof( Image ) === false ) {
                image = new Image( img );
            }

            this._images[ face ].image = image;
            this._images[ face ].format = imageFormat;
            this._images[ face ].dirty = true;
            this.dirty();
        },
        getImage: function ( face ) {
            return this._images[ face ].image;
        },

        applyTexImage2DLoad: function ( gl, target, level, internalFormat, format, type, image ) {
            if ( !image ) {
                return false;
            }

            if ( !image.isReady() ) {
                return false;
            }


            this.setTextureSize( image.getWidth(), image.getHeight() );

            MACROUTILS.timeStamp( 'osgjs.metrics:texImage2d' );
            gl.texImage2D( target, 0, internalFormat, internalFormat, type, image.getImage() );
            return true;
        },

        _applyImageTarget: function ( gl, internalFormat, target ) {
            var imgObject = this._images[ target ];
            if ( !imgObject ) {
                return 0;
            }

            if ( !imgObject.dirty ) {
                return 1;
            }

            if ( this.applyTexImage2DLoad( gl,
                target,
                0,
                internalFormat,
                internalFormat,
                gl.UNSIGNED_BYTE,
                imgObject.image ) ) {
                imgObject.dirty = false;
                if ( this._unrefImageDataAfterApply ) {
                    delete this._images[ target ];
                }
                return 1;
            }
            return 0;
        },

        apply: function ( state ) {
            var gl = state.getGraphicContext();

            if ( this._textureObject !== undefined && !this.isDirty() ) {
                this._textureObject.bind( gl );

            } else if ( this.defaultType ) {
                gl.bindTexture( this._textureTarget, null );

            } else {
                if ( !this._textureObject ) {

                    // must be called before init
                    this.computeTextureFormat();

                    this.init( gl );
                }
                this._textureObject.bind( gl );

                var internalFormat = this._internalFormat;

                var valid = 0;
                valid += this._applyImageTarget( gl, internalFormat, gl.TEXTURE_CUBE_MAP_POSITIVE_X );
                valid += this._applyImageTarget( gl, internalFormat, gl.TEXTURE_CUBE_MAP_NEGATIVE_X );

                valid += this._applyImageTarget( gl, internalFormat, gl.TEXTURE_CUBE_MAP_POSITIVE_Y );
                valid += this._applyImageTarget( gl, internalFormat, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y );

                valid += this._applyImageTarget( gl, internalFormat, gl.TEXTURE_CUBE_MAP_POSITIVE_Z );
                valid += this._applyImageTarget( gl, internalFormat, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z );
                if ( valid === 6 ) {
                    this.setDirty( false );
                    this.applyFilterParameter( gl, this._textureTarget );
                    this.generateMipmap( gl, this._textureTarget );
                }
            } // render to cubemap not yet implemented
        }
    } ), 'osg', 'TextureCubeMap' );

    return TextureCubeMap;
} );

define( 'osg/UpdateVisitor',[
    'osg/Utils',
    'osg/NodeVisitor',
    'osg/FrameStamp'
], function ( MACROUTILS, NodeVisitor, FrameStamp ) {

    var UpdateVisitor = function () {
        NodeVisitor.call( this );
        var framestamp = new FrameStamp();
        this.getFrameStamp = function () {
            return framestamp;
        };
        this.setFrameStamp = function ( s ) {
            framestamp = s;
        };
    };
    UpdateVisitor.prototype = MACROUTILS.objectInehrit( NodeVisitor.prototype, {
        apply: function ( node ) {
            var ncs = node.getUpdateCallbackList();
            for ( var i = 0; i < ncs.length; i++ ) {
                if ( !ncs[ i ].update( node, this ) ) {
                    return;
                }
            }
            this.traverse( node );
        }
    } );

    return UpdateVisitor;
} );

define( 'osg/Vec2',[], function () {

    /** @class Vec2 Operations */
    var Vec2 = {
        copy: function ( a, r ) {
            r[ 0 ] = a[ 0 ];
            r[ 1 ] = a[ 1 ];
            return r;
        },

        valid: function ( a ) {
            if ( isNaN( a[ 0 ] ) ) {
                return false;
            }
            if ( isNaN( a[ 1 ] ) ) {
                return false;
            }
            return true;
        },

        mult: function ( a, b, r ) {
            r[ 0 ] = a[ 0 ] * b;
            r[ 1 ] = a[ 1 ] * b;
            return r;
        },

        length2: function ( a ) {
            return a[ 0 ] * a[ 0 ] + a[ 1 ] * a[ 1 ];
        },

        length: function ( a ) {
            return Math.sqrt( a[ 0 ] * a[ 0 ] + a[ 1 ] * a[ 1 ] );
        },

        distance2: function ( a, b ) {
            var x = a[ 0 ] - b[ 0 ];
            var y = a[ 1 ] - b[ 1 ];
            return x * x + y * y;
        },

        distance: function ( a, b ) {
            var x = a[ 0 ] - b[ 0 ];
            var y = a[ 1 ] - b[ 1 ];
            return Math.sqrt( x * x + y * y );
        },

        /**
        normalize an Array of 2 elements and write it in r
     */
        normalize: function ( a, r ) {
            var norm = this.length2( a );
            if ( norm > 0.0 ) {
                var inv = 1.0 / Math.sqrt( norm );
                r[ 0 ] = a[ 0 ] * inv;
                r[ 1 ] = a[ 1 ] * inv;
            } else {
                r[ 0 ] = a[ 0 ];
                r[ 1 ] = a[ 1 ];
            }
            return r;
        },

        /**
        Compute the dot product
    */
        dot: function ( a, b ) {
            return a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ];
        },

        /**
       Compute a - b and put the result in r
     */
        sub: function ( a, b, r ) {
            r[ 0 ] = a[ 0 ] - b[ 0 ];
            r[ 1 ] = a[ 1 ] - b[ 1 ];
            return r;
        },

        add: function ( a, b, r ) {
            r[ 0 ] = a[ 0 ] + b[ 0 ];
            r[ 1 ] = a[ 1 ] + b[ 1 ];
            return r;
        },

        neg: function ( a, r ) {
            r[ 0 ] = -a[ 0 ];
            r[ 1 ] = -a[ 1 ];
            return r;
        },

        lerp: function ( t, a, b, r ) {
            var tmp = 1.0 - t;
            r[ 0 ] = a[ 0 ] * tmp + t * b[ 0 ];
            r[ 1 ] = a[ 1 ] * tmp + t * b[ 1 ];
            return r;
        }

    };

    return Vec2;
} );

define( 'osg/Viewport',[
    'osg/Utils',
    'osg/StateAttribute',
    'osg/Matrix'
], function ( MACROUTILS, StateAttribute, Matrix ) {

    var Viewport = function ( x, y, w, h ) {
        StateAttribute.call( this );

        if ( x === undefined ) {
            x = 0;
        }
        if ( y === undefined ) {
            y = 0;
        }
        if ( w === undefined ) {
            w = 800;
        }
        if ( h === undefined ) {
            h = 600;
        }

        this._x = x;
        this._y = y;
        this._width = w;
        this._height = h;
        this._dirty = true;
    };

    Viewport.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInehrit( StateAttribute.prototype, {
        attributeType: 'Viewport',
        cloneType: function () {
            return new Viewport();
        },
        getType: function () {
            return this.attributeType;
        },
        getTypeMember: function () {
            return this.attributeType;
        },
        apply: function ( state ) {
            var gl = state.getGraphicContext();
            gl.viewport( this._x, this._y, this._width, this._height );
            this._dirty = false;
        },
        setViewport: function ( x, y, width, height ) {
            this._x = x;
            this._y = y;
            this._width = width;
            this._height = height;
            this.dirty();
        },
        x: function () {
            return this._x;
        },
        y: function () {
            return this._y;
        },
        width: function () {
            return this._width;
        },
        height: function () {
            return this._height;
        },
        computeWindowMatrix: ( function () {
            var translate = Matrix.create();
            var scale = Matrix.create();
            return function () {
                // res = Matrix offset * Matrix scale * Matrix translate
                Matrix.makeTranslate( 1.0, 1.0, 1.0, translate );
                Matrix.makeScale( 0.5 * this._width, 0.5 * this._height, 0.5, scale );
                var offset = Matrix.makeTranslate( this._x, this._y, 0.0, Matrix.create() );
                //return Matrix.mult(Matrix.mult(translate, scale, translate), offset, offset);
                return Matrix.preMult( offset, Matrix.preMult( scale, translate ) );
            };
        } )()
    } ), 'osg', 'Viewport' );

    return Viewport;
} );

define( 'osg/WebGLCaps',[
], function () {

    var WebGLCaps = function() {
        this._webGLExtensions = {};
        this._webGLParameters = {};
        this._webGLShaderMaxInt = 'NONE';
        this._webGLShaderMaxFloat = 'NONE';
    };

    WebGLCaps.prototype = {

        init: function( gl ) {
            this.initWebGLParameters( gl );
            this.initWebGLExtensions( gl );
        },

        getWebGLParameter: function ( str ) {
            return this._webGLParameters[ str ];
        },
        getWebGLParameters: function () {
            return this._webGLParameters;
        },
        getShaderMaxPrecisionFloat: function () {
            return this._webGLParameters.MAX_SHADER_PRECISION_FLOAT;
        },
        getShaderMaxPrecisionInt: function () {
            return this._webGLParameters.MAX_SHADER_PRECISION_INT;
        },
        initWebGLParameters: function ( gl ) {
            if ( gl === undefined )
                return;

            var limits = [
                'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
                'MAX_CUBE_MAP_TEXTURE_SIZE',
                'MAX_FRAGMENT_UNIFORM_VECTORS',
                'MAX_RENDERBUFFER_SIZE',
                'MAX_TEXTURE_IMAGE_UNITS',
                'MAX_TEXTURE_SIZE',
                'MAX_VARYING_VECTORS',
                'MAX_VERTEX_ATTRIBS',
                'MAX_VERTEX_TEXTURE_IMAGE_UNITS',
                'MAX_VERTEX_UNIFORM_VECTORS',
                'MAX_VIEWPORT_DIMS',
                'SHADING_LANGUAGE_VERSION',
                'VERSION',
                'VENDOR',
                'RENDERER',
                'ALIASED_LINE_WIDTH_RANGE',
                'ALIASED_POINT_SIZE_RANGE',
                'RED_BITS',
                'GREEN_BITS',
                'BLUE_BITS',
                'ALPHA_BITS',
                'DEPTH_BITS',
                'STENCIL_BITS'
            ];
            var params = this._webGLParameters;
            for ( var i = 0, len = limits.length; i < len; ++i ) {
                var par = limits[ i ];
                params[ par ] = gl.getParameter( gl[ par ] );
            }

            //shader precisions for float
            if ( gl.getShaderPrecisionFormat( gl.FRAGMENT_SHADER, gl.HIGH_FLOAT ).precision !== 0 ) {
                params.MAX_SHADER_PRECISION_FLOAT = 'high';
            }
            else if ( gl.getShaderPrecisionFormat( gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT ).precision !== 0 ) {
                params.MAX_SHADER_PRECISION_FLOAT = 'medium';
            }
            else if ( gl.getShaderPrecisionFormat( gl.FRAGMENT_SHADER, gl.LOW_FLOAT ).precision !== 0 ) {
                params.MAX_SHADER_PRECISION_FLOAT = 'low';
            }
            else {
                params.MAX_SHADER_PRECISION_FLOAT = 'none';
            }

            //shader precisions for float
            if ( gl.getShaderPrecisionFormat( gl.FRAGMENT_SHADER, gl.HIGH_INT ).precision !== 0 ) {
                params.MAX_SHADER_PRECISION_INT = 'high';
            }
            else if ( gl.getShaderPrecisionFormat( gl.FRAGMENT_SHADER, gl.MEDIUM_INT ).precision !== 0 ) {
                params.MAX_SHADER_PRECISION_INT = 'medium';
            }
            else if ( gl.getShaderPrecisionFormat( gl.FRAGMENT_SHADER, gl.LOW_INT ).precision !== 0 ) {
                params.MAX_SHADER_PRECISION_INT = 'low';
            }
            else {
                params.MAX_SHADER_PRECISION_INT = 'none';
            }

            // TODO ?
            // try to compile a small shader to test the spec is respected
        },
        getWebGLExtension: function ( str ) {
            return this._webGLExtensions[ str ];
        },
        getWebGLExtensions: function () {
            return this._webGLExtensions;
        },
        initWebGLExtensions: function ( gl ) {
            if ( gl === undefined )
                return;
            var supported = gl.getSupportedExtensions();
            var ext = this._webGLExtensions;
            // we load all the extensions
            for ( var i = 0, len = supported.length; i < len; ++i ) {
                var sup = supported[ i ];
                ext[ sup ] = gl.getExtension( sup );
            }
            // TODO ?
            // check if the extensions are REALLY supported ?
            // cf http://codeflow.org/entries/2013/feb/22/how-to-write-portable-webgl/#how-can-i-detect-if-i-can-render-to-floating-point-textures
        }
    };


    return WebGLCaps;
});

define( 'osg/osg',[
    'osg/BlendColor',
    'osg/BlendFunc',
    'osg/BoundingBox',
    'osg/BoundingSphere',
    'osg/BufferArray',
    'osg/Camera',
    'osg/ComputeMatrixFromNodePath',
    'osg/CullFace',
    'osg/CullSettings',
    'osg/CullStack',
    'osg/CullVisitor',
    'osg/Depth',
    'osg/DrawArrayLengths',
    'osg/DrawArrays',
    'osg/DrawElements',
    'osg/EllipsoidModel',
    'osg/FrameBufferObject',
    'osg/FrameStamp',
    'osg/Geometry',
    'osg/Image',
    'osg/KdTree',
    'osg/KdTreeBuilder',
    'osg/Light',
    'osg/LightSource',
    'osg/LineWidth',
    'osg/Lod',
    'osg/Material',
    'osg/Math',
    'osg/Matrix',
    'osg/MatrixTransform',
    'osg/Node',
    'osg/NodeVisitor',
    'osg/Notify',
    'osg/Object',
    'osg/PrimitiveSet',
    'osg/Program',
    'osg/Projection',
    'osg/Quat',
    'osg/RenderBin',
    'osg/RenderStage',
    'osg/Shader',
    'osg/ShaderGenerator',
    'osg/Shape',
    'osg/Stack',
    'osg/State',
    'osg/StateAttribute',
    'osg/StateGraph',
    'osg/StateSet',
    'osg/Texture',
    'osg/TextureCubeMap',
    'osg/Transform',
    'osg/TriangleIndexFunctor',
    'osg/Uniform',
    'osg/UpdateVisitor',
    'osg/Utils',
    'osg/Vec2',
    'osg/Vec3',
    'osg/Vec4',
    'osg/Viewport',
    'osgUtil/osgPool',
    'osg/TransformEnums',
    'osg/WebGLCaps'
], function( BlendColor, BlendFunc, BoundingBox, BoundingSphere, BufferArray, Camera, ComputeMatrixFromNodePath, CullFace, CullSettings, CullStack, CullVisitor, Depth, DrawArrayLengths, DrawArrays, DrawElements, EllipsoidModel, FrameBufferObject, FrameStamp, Geometry, Image, KdTree, KdTreeBuilder, Light, LightSource, LineWidth, Lod, Material, Math, Matrix, MatrixTransform, Node, NodeVisitor, Notify, Object, PrimitiveSet, Program, Projection, Quat, RenderBin, RenderStage, Shader, ShaderGenerator, Shape, Stack, State, StateAttribute, StateGraph, StateSet, Texture, TextureCubeMap, Transform, TriangleIndexFunctor, Uniform, UpdateVisitor, MACROUTILS, Vec2, Vec3, Vec4, Viewport, osgPool, TransformEnums, WebGLCaps ) {

    var osg = {};

    osg.BlendColor = BlendColor;
    osg.BlendFunc = BlendFunc;
    osg.BoundingBox = BoundingBox;
    osg.BoundingSphere = BoundingSphere;
    osg.BufferArray = BufferArray;
    osg.Camera = Camera;
    MACROUTILS.objectMix( osg, ComputeMatrixFromNodePath );
    osg.CullFace = CullFace;
    osg.CullSettings = CullSettings;
    osg.CullStack = CullStack;
    osg.CullVisitor = CullVisitor;
    osg.Depth = Depth;
    osg.DrawArrayLengths = DrawArrayLengths;
    osg.DrawArrays = DrawArrays;
    osg.DrawElements = DrawElements;
    osg.EllipsoidModel = EllipsoidModel;
    osg.WGS_84_RADIUS_EQUATOR = EllipsoidModel.WGS_84_RADIUS_EQUATOR;
    osg.WGS_84_RADIUS_POLAR = EllipsoidModel.WGS_84_RADIUS_POLAR;
    osg.FrameBufferObject = FrameBufferObject;
    osg.FrameStamp = FrameStamp;
    osg.Geometry = Geometry;
    osg.Image = Image;
    osg.KdTree = KdTree;
    osg.KdTreeBuilder = KdTreeBuilder;
    osg.Light = Light;
    osg.LightSource = LightSource;
    osg.LineWidth = LineWidth;
    osg.Lod = Lod;
    osg.Material = Material;
    MACROUTILS.objectMix( osg, Math );
    osg.Matrix = Matrix;
    osg.MatrixTransform = MatrixTransform;
    osg.Node = Node;
    osg.NodeVisitor = NodeVisitor;
    MACROUTILS.objectMix( osg, Notify );
    osg.Object = Object;
    osg.PrimitiveSet = PrimitiveSet;
    osg.Program = Program;
    osg.Projection = Projection;
    osg.Quat = Quat;
    osg.RenderBin = RenderBin;
    osg.RenderStage = RenderStage;
    osg.Shader = Shader;
    osg.ShaderGenerator = ShaderGenerator;
    osg.ShaderGeneratorType = ShaderGenerator.Type;
    MACROUTILS.objectMix( osg, Shape );
    osg.Stack = Stack;
    osg.State = State;
    osg.StateAttribute = StateAttribute;
    osg.StateGraph = StateGraph;
    osg.StateSet = StateSet;
    osg.Texture = Texture;
    osg.TextureCubeMap = TextureCubeMap;
    osg.Transform = Transform;
    osg.TriangleIndexFunctor = TriangleIndexFunctor;
    osg.Uniform = Uniform;
    osg.UpdateVisitor = UpdateVisitor;
    MACROUTILS.objectMix( osg, MACROUTILS );
    osg.Vec2 = Vec2;
    osg.Vec3 = Vec3;
    osg.Vec4 = Vec4;
    osg.Viewport = Viewport;

    osg.memoryPools = osgPool.memoryPools;

    osg.Transform.RELATIVE_RF = TransformEnums.RELATIVE_RF;
    osg.Transform.ABSOLUTE_RF = TransformEnums.ABSOLUTE_RF;
    
    osg.WebGLCaps = WebGLCaps;

    return osg;
} );

define( 'osgAnimation/Animation',[
    'osg/Utils',
    'osg/Object'
], function ( MACROUTILS, Object ) {

    /**
     *  Animation
     *  @class Animation
     */
    var Animation = function () {
        Object.call( this );
        this._channels = [];
    };

    /** @lends Animation.prototype */
    Animation.prototype = MACROUTILS.objectInehrit( Object.prototype, {
        getChannels: function () {
            return this._channels;
        },
        getDuration: function () {
            var tmin = 1e5;
            var tmax = -1e5;
            for ( var i = 0, l = this._channels.length; i < l; i++ ) {
                var channel = this._channels[ i ];
                tmin = Math.min( tmin, channel.getStartTime() );
                tmax = Math.max( tmax, channel.getEndTime() );
            }
            return tmax - tmin;
        }

    } );

    return Animation;
} );

define( 'osgAnimation/AnimationUpdateCallback',[
    'osg/Notify',
    'osg/Utils',
    'osg/Object'
], function ( Notify, MACROUTILS, Object ) {

    /**
     *  AnimationUpdateCallback
     *  @class AnimationUpdateCallback
     */
    var AnimationUpdateCallback = function () {};

    /** @lends AnimationUpdateCallback.prototype */
    AnimationUpdateCallback.prototype = MACROUTILS.objectInehrit( Object.prototype, {

        linkChannel: function () {},
        linkAnimation: function ( anim ) {
            var name = this.getName();
            if ( name.length === 0 ) {
                Notify.log( 'no name on an update callback, discard' );
                return 0;
            }
            var nbLinks = 0;
            var channels = anim.getChannels();
            for ( var i = 0, l = channels.length; i < l; i++ ) {
                var channel = channels[ i ];
                if ( channel.getTargetName() === name ) {
                    this.linkChannel( channel );
                    nbLinks++;
                }
            }
            return nbLinks;
        }
    } );

    return AnimationUpdateCallback;
} );

define( 'osgAnimation/BasicAnimationManager',[
    'osg/Notify',
    'osg/Utils',
    'osg/Object'
], function ( Notify, MACROUTILS, Object ) {

    /**
     *  BasicAnimationManager
     *  @class BasicAnimationManager
     */
    var BasicAnimationManager = function () {
        Object.call( this );
        this._animations = {};

        this._actives = {};
        this._actives._keys = [];

        this._lastUpdate = undefined;
        this._targets = [];
    };

    /** @lends BasicAnimationManager.prototype */
    BasicAnimationManager.prototype = MACROUTILS.objectInehrit( Object.prototype, {
        _updateAnimation: function ( animationParameter, t, priority ) {
            var duration = animationParameter.duration;
            var weight = animationParameter.weight;
            var animation = animationParameter.anim;
            var start = animationParameter.start;
            var loop = animationParameter.loop;

            if ( loop > 0 ) {
                var playedTimes = t - start;
                if ( playedTimes >= loop * duration ) {
                    return true;
                }
            }

            t = ( t - start ) % duration;
            var callback = animationParameter.callback;
            if ( callback ) {
                callback( t );
            }

            var channels = animation.getChannels();
            for ( var i = 0, l = channels.length; i < l; i++ ) {
                var channel = channels[ i ];
                channel.update( t, weight, priority );
            }
            return false;
        },
        update: function ( node, nv ) {
            var t = nv.getFrameStamp().getSimulationTime();
            this.updateManager( t );
            return true;
        },
        updateManager: function ( t ) {

            var targets = this._targets;
            for ( var i = 0, l = targets.length; i < l; i++ ) {
                targets[ i ].reset();
            }
            if ( this._actives._keys.length > 0 ) {
                var pri = this._actives._keys.length - 1;
                while ( pri >= 0 ) {
                    var layer = this._actives[ pri ];
                    var keys = this._actives[ pri ]._keys;
                    var removes = [];
                    for ( var ai = 0, al = keys.length; ai < al; ai++ ) {
                        var key = keys[ ai ];
                        var anim = layer[ key ];
                        if ( anim.start === undefined ) {
                            anim.start = t;
                        }
                        var remove = this._updateAnimation( anim, t, pri );
                        if ( remove ) {
                            removes.push( ai );
                        }
                    }

                    // remove finished animation
                    for ( var j = removes.length - 1; j >= 0; j-- ) {
                        var k = keys[ j ];
                        keys.splice( j, 1 );
                        delete layer[ k ];
                    }

                    pri--;
                }
            }
        },

        stopAll: function () {},
        isPlaying: function ( name ) {
            if ( this._actives._keys.length > 0 ) {
                var pri = this._actives._keys.length - 1;
                while ( pri >= 0 ) {
                    if ( this._actives[ pri ][ name ] ) {
                        return true;
                    }
                    pri--;
                }
            }
            return false;
        },
        stopAnimation: function ( name ) {
            if ( this._actives._keys.length > 0 ) {
                var pri = this._actives._keys.length - 1;
                var filterFunction = function ( element /*, index , array */ ) {
                    return element !== '_keys';
                };
                while ( pri >= 0 ) {
                    if ( this._actives[ pri ][ name ] ) {
                        delete this._actives[ pri ][ name ];
                        this._actives[ pri ]._keys = window.Object.keys( this._actives[ pri ] ).filter( filterFunction );
                        return;
                    }
                    pri--;
                }
            }
        },
        playAnimationObject: function ( obj ) {
            if ( obj.name === undefined ) {
                return;
            }

            var anim = this._animations[ obj.name ];
            if ( anim === undefined ) {
                Notify.info( 'no animation ' + obj.name + ' found' );
                return;
            }

            if ( this.isPlaying( obj.name ) ) {
                return;
            }

            if ( obj.priority === undefined ) {
                obj.priority = 0;
            }

            if ( obj.weight === undefined ) {
                obj.weight = 1.0;
            }

            if ( obj.timeFactor === undefined ) {
                obj.timeFactor = 1.0;
            }

            if ( obj.loop === undefined ) {
                obj.loop = 0;
            }

            if ( this._actives[ obj.priority ] === undefined ) {
                this._actives[ obj.priority ] = {};
                this._actives[ obj.priority ]._keys = [];
                this._actives._keys.push( obj.priority ); // = window.Object.keys(this._actives);
            }

            obj.start = undefined;
            obj.duration = anim.getDuration();
            obj.anim = anim;
            this._actives[ obj.priority ][ obj.name ] = obj;
            this._actives[ obj.priority ]._keys.push( obj.name );
        },

        playAnimation: function ( name, priority, weight ) {
            var animName = name;
            if ( typeof name === 'object' ) {
                if ( name.getName === undefined ) {
                    return this.playAnimationObject( name );
                } else {
                    animName = name.getName();
                }
            }
            var obj = {
                'name': animName,
                'priority': priority,
                'weight': weight
            };

            return this.playAnimationObject( obj );
        },

        registerAnimation: function ( anim ) {
            this._animations[ anim.getName() ] = anim;
            this.buildTargetList();
        },
        getAnimationMap: function () {
            return this._animations;
        },
        buildTargetList: function () {
            this._targets.length = 0;
            var keys = window.Object.keys( this._animations );
            for ( var i = 0, l = keys.length; i < l; i++ ) {
                var a = this._animations[ keys[ i ] ];
                var channels = a.getChannels();
                for ( var c = 0, lc = channels.length; c < lc; c++ ) {
                    var channel = channels[ c ];
                    this._targets.push( channel.getTarget() );
                }
            }
        }

    } );

    return BasicAnimationManager;
} );

define( 'osgAnimation/Channel',[
    'osg/Utils',
    'osg/Object'
], function ( MACROUTILS, Object ) {

    /**
     *  Channel is responsible to interpolate keys
     *  @class Channel
     */
    var Channel = function ( sampler, target ) {
        Object.call( this );
        this._sampler = sampler;
        this._target = target;
        this._targetName = undefined;
        this._data = {
            'value': undefined,
            'key': 0
        };
    };

    /** @lends Channel.prototype */
    Channel.prototype = MACROUTILS.objectInehrit( Object.prototype, {
        getKeyframes: function () {
            return this._sampler.getKeyframes();
        },
        setKeyframes: function ( keys ) {
            this._sampler.setKeyframes( keys );
        },
        getStartTime: function () {
            return this._sampler.getStartTime();
        },
        getEndTime: function () {
            return this._sampler.getEndTime();
        },
        getSampler: function () {
            return this._sampler;
        },
        setSampler: function ( sampler ) {
            this._sampler = sampler;
        },
        getTarget: function () {
            return this._target;
        },
        setTarget: function ( target ) {
            this._target = target;
        },
        setTargetName: function ( name ) {
            this._targetName = name;
        },
        getTargetName: function () {
            return this._targetName;
        },
        update: function ( t, weight, priority ) {
            weight = weight || 1.0;
            priority = priority || 0.0;

            // skip if weight == 0
            if ( weight < 1e-4 )
                return;
            var data = this._data;
            this._sampler.getValueAt( t, data );
            this._target.update.call( this._target, weight, data.value, priority );
        },
        reset: function () {
            this._target.reset();
        }
    } );

    return Channel;
} );

define( 'osgAnimation/Easing',[], function () {

	var easeOutQuad = function ( t ) {
		return -( t * ( t - 2.0 ) );
	};
	var easeInQuad = function ( t ) {
		return ( t * t );
	};
	var easeOutCubic = function ( t ) {
		t = t - 1.0;
		return ( t * t * t + 1 );
	};
	var easeInCubic = function ( t ) {
		return ( t * t * t );
	};
	var easeOutQuart = function ( t ) {
		t = t - 1;
		return -( t * t * t * t - 1 );
	};
	var easeInQuart = function ( t ) {
		return ( t * t * t * t );
	};
	var easeOutElastic = function ( t ) {
		return Math.pow( 2.0, -10.0 * t ) * Math.sin( ( t - 0.3 / 4.0 ) * ( 2.0 * Math.PI ) / 0.3 ) + 1.0;
	};
	//osgAnimation.EaseInElastic = function(t) { return ; };
	var easeOutBounce = function ( t ) {
		if ( t < ( 1 / 2.75 ) ) {
			return ( 7.5625 * t * t );
		} else if ( t < ( 2 / 2.75 ) ) {
			return ( 7.5625 * ( t -= ( 1.5 / 2.75 ) ) * t + 0.75 );
		} else if ( t < ( 2.5 / 2.75 ) ) {
			return ( 7.5625 * ( t -= ( 2.25 / 2.75 ) ) * t + 0.9375 );
		} else {
			return ( 7.5625 * ( t -= ( 2.625 / 2.75 ) ) * t + 0.984375 );
		}
	};

	return {
		easeOutQuad: easeOutQuad,
		easeInQuad: easeInQuad,
		easeOutCubic: easeOutCubic,
		easeInCubic: easeInCubic,
		easeOutQuart: easeOutQuart,
		easeInQuart: easeInQuart,
		easeOutElastic: easeOutElastic,
		easeOutBounce: easeOutBounce,
		EaseOutQuad: easeOutQuad,
		EaseInQuad: easeInQuad,
		EaseOutCubic: easeOutCubic,
		EaseInCubic: easeInCubic,
		EaseOutQuart: easeOutQuart,
		EaseInQuart: easeInQuart,
		EaseOutElastic: easeOutElastic,
		EaseOutBounce: easeOutBounce
	};
} );

define( 'osgAnimation/Sampler',[], function () {

    /**
     *  Sampler is responsible to interpolate keys
     *  @class Sampler
     */
    var Sampler = function ( keys, interpolator ) {
        if ( !keys ) {
            keys = [];
        }
        this._keys = keys;
        this._interpolator = interpolator;
    };

    /** @lends Sampler.prototype */
    Sampler.prototype = {

        getKeyframes: function () {
            return this._keys;
        },
        setKeyframes: function ( keys ) {
            this._keys = keys;
        },
        setInterpolator: function ( interpolator ) {
            this._interpolator = interpolator;
        },
        getInterpolator: function () {
            return this._interpolator;
        },
        getStartTime: function () {
            if ( this._keys.length === 0 ) {
                return undefined;
            }
            return this._keys[ 0 ].t;
        },
        getEndTime: function () {
            if ( this._keys.length === 0 ) {
                return undefined;
            }
            return this._keys[ this._keys.length - 1 ].t;
        },

        // result contains the keyIndex where to start, this key
        // will be updated when calling the Interpolator
        // result.value will contain the interpolation result
        // { 'value': undefined, 'keyIndex': 0 };
        getValueAt: function ( t, result ) {
            // reset the key if invalid
            if ( this._keys[ result.key ].t > t ) {
                result.key = 0;
            }
            this._interpolator( this._keys, t, result );
        }
    };

    return Sampler;
} );

define( 'osgAnimation/Interpolator',[
    'osg/Quat'
], function ( Quat ) {

    /**
     *  Interpolator provide interpolation function to sampler
     */
    var Vec3LerpInterpolator = function ( keys, t, result ) {
        var keyStart;
        var startTime;
        var keyEnd = keys[ keys.length - 1 ];
        var endTime = keyEnd.t;
        if ( t >= endTime ) {
            result.key = 0;
            result.value[ 0 ] = keyEnd[ 0 ];
            result.value[ 1 ] = keyEnd[ 1 ];
            result.value[ 2 ] = keyEnd[ 2 ];
            return;
        } else {
            keyStart = keys[ 0 ];
            startTime = keyStart.t;

            if ( t <= startTime ) {
                result.key = 0;
                result.value[ 0 ] = keyStart[ 0 ];
                result.value[ 1 ] = keyStart[ 1 ];
                result.value[ 2 ] = keyStart[ 2 ];
                return;
            }
        }

        var i1 = result.key;
        while ( keys[ i1 + 1 ].t < t ) {
            i1++;
        }
        var i2 = i1 + 1;

        var t1 = keys[ i1 ].t;
        var x1 = keys[ i1 ][ 0 ];
        var y1 = keys[ i1 ][ 1 ];
        var z1 = keys[ i1 ][ 2 ];

        var t2 = keys[ i2 ].t;
        var x2 = keys[ i2 ][ 0 ];
        var y2 = keys[ i2 ][ 1 ];
        var z2 = keys[ i2 ][ 2 ];

        var r = ( t - t1 ) / ( t2 - t1 );

        result.value[ 0 ] = x1 + ( x2 - x1 ) * r;
        result.value[ 1 ] = y1 + ( y2 - y1 ) * r;
        result.value[ 2 ] = z1 + ( z2 - z1 ) * r;
        result.key = i1;
    };

    var QuatLerpInterpolator = function ( keys, t, result ) {
        var keyStart;
        var startTime;
        var keyEnd = keys[ keys.length - 1 ];
        var endTime = keyEnd.t;
        if ( t >= endTime ) {
            result.key = 0;
            result.value[ 0 ] = keyEnd[ 0 ];
            result.value[ 1 ] = keyEnd[ 1 ];
            result.value[ 2 ] = keyEnd[ 2 ];
            result.value[ 3 ] = keyEnd[ 3 ];
            return;
        } else {
            keyStart = keys[ 0 ];
            startTime = keyStart.t;

            if ( t <= startTime ) {
                result.key = 0;
                result.value[ 0 ] = keyStart[ 0 ];
                result.value[ 1 ] = keyStart[ 1 ];
                result.value[ 2 ] = keyStart[ 2 ];
                result.value[ 3 ] = keyStart[ 3 ];
                return;
            }
        }

        var i1 = result.key;
        while ( keys[ i1 + 1 ].t < t ) {
            i1++;
        }
        var i2 = i1 + 1;

        var t1 = keys[ i1 ].t;
        var x1 = keys[ i1 ][ 0 ];
        var y1 = keys[ i1 ][ 1 ];
        var z1 = keys[ i1 ][ 2 ];
        var w1 = keys[ i1 ][ 3 ];

        var t2 = keys[ i2 ].t;
        var x2 = keys[ i2 ][ 0 ];
        var y2 = keys[ i2 ][ 1 ];
        var z2 = keys[ i2 ][ 2 ];
        var w2 = keys[ i2 ][ 3 ];

        var r = ( t - t1 ) / ( t2 - t1 );

        result.value[ 0 ] = x1 + ( x2 - x1 ) * r;
        result.value[ 1 ] = y1 + ( y2 - y1 ) * r;
        result.value[ 2 ] = z1 + ( z2 - z1 ) * r;
        result.value[ 3 ] = w1 + ( w2 - w1 ) * r;
        result.key = i1;
    };

    var QuatSlerpInterpolator = function ( keys, t, result ) {
        var keyStart;
        var startTime;
        var keyEnd = keys[ keys.length - 1 ];
        var endTime = keyEnd.t;
        if ( t >= endTime ) {
            result.key = 0;
            result.value[ 0 ] = keyEnd[ 0 ];
            result.value[ 1 ] = keyEnd[ 1 ];
            result.value[ 2 ] = keyEnd[ 2 ];
            result.value[ 3 ] = keyEnd[ 3 ];
            return;
        } else {
            keyStart = keys[ 0 ];
            startTime = keyStart.t;

            if ( t <= startTime ) {
                result.key = 0;
                result.value[ 0 ] = keyStart[ 0 ];
                result.value[ 1 ] = keyStart[ 1 ];
                result.value[ 2 ] = keyStart[ 2 ];
                result.value[ 3 ] = keyStart[ 3 ];
                return;
            }
        }

        var i1 = result.key;
        while ( keys[ i1 + 1 ].t < t ) {
            i1++;
        }
        var i2 = i1 + 1;

        var t1 = keys[ i1 ].t;
        var t2 = keys[ i2 ].t;
        var r = ( t - t1 ) / ( t2 - t1 );

        Quat.slerp( r, keys[ i1 ], keys[ i2 ], result.value );
        result.key = i1;
    };

    /**
     *  Interpolator provide interpolation function to sampler
     */
    var FloatLerpInterpolator = function ( keys, t, result ) {
        var keyStart;
        var startTime;
        var keyEnd = keys[ keys.length - 1 ];
        var endTime = keyEnd.t;
        if ( t >= endTime ) {
            result.key = 0;
            result.value = keyEnd[ 0 ];
            return;
        } else {
            keyStart = keys[ 0 ];
            startTime = keyStart.t;

            if ( t <= startTime ) {
                result.key = 0;
                result.value = keyStart[ 0 ];
                return;
            }
        }

        var i1 = result.key;
        while ( keys[ i1 + 1 ].t < t ) {
            i1++;
        }
        var i2 = i1 + 1;

        var t1 = keys[ i1 ].t;
        var x1 = keys[ i1 ][ 0 ];

        var t2 = keys[ i2 ].t;
        var x2 = keys[ i2 ][ 0 ];

        var r = ( t - t1 ) / ( t2 - t1 );
        result.value = x1 + ( x2 - x1 ) * r;
        result.key = i1;
    };

    /**
     *  Interpolator provide interpolation function to sampler
     */
    var FloatStepInterpolator = function ( keys, t, result ) {
        var keyStart;
        var startTime;
        var keyEnd = keys[ keys.length - 1 ];
        var endTime = keyEnd.t;
        if ( t >= endTime ) {
            result.key = 0;
            result.value = keyEnd[ 0 ];
            return;
        } else {
            keyStart = keys[ 0 ];
            startTime = keyStart.t;

            if ( t <= startTime ) {
                result.key = 0;
                result.value = keyStart[ 0 ];
                return;
            }
        }

        var i1 = result.key;
        while ( keys[ i1 + 1 ].t < t ) {
            i1++;
        }
        //var i2 = i1 + 1;

        //var t1 = keys[ i1 ].t;
        var x1 = keys[ i1 ][ 0 ];
        result.value = x1;
        result.key = i1;
    };

    return {
        Vec3LerpInterpolator: Vec3LerpInterpolator,
        QuatLerpInterpolator: QuatLerpInterpolator,
        QuatSlerpInterpolator: QuatSlerpInterpolator,
        FloatLerpInterpolator: FloatLerpInterpolator,
        FloatStepInterpolator: FloatStepInterpolator
    };
} );

define( 'osgAnimation/Target',[], function ( ) {

    /**
     *  Target keep internal data of element to animate, and some function to merge them
     *  @class Target
     */
    var Target = function () {
        this._weight = 0;
        this._priorityWeight = 0;
        this._count = 0;
        this._lastPriority = 0;
        this._target = undefined;
    };

    Target.prototype = {
        reset: function () {
            this._weight = 0;
            this._priorityWeight = 0;
        },
        getValue: function () {
            return this._target;
        }
    };

    return Target;
} );

define( 'osgAnimation/FloatTarget',[
    'osg/Utils',
    'osgAnimation/Target'
], function ( MACROUTILS, Target ) {

    var FloatTarget = function ( value ) {
        Target.call( this );
        this._target = [ value ];
    };

    FloatTarget.prototype = MACROUTILS.objectInehrit( Target.prototype, {
        update: function ( weight, val, priority ) {
            if ( this._weight || this._priorityWeight ) {

                if ( this._lastPriority !== priority ) {
                    // change in priority
                    // add to weight with the same previous priority cumulated weight
                    this._weight += this._priorityWeight * ( 1.0 - this._weight );
                    this._priorityWeight = 0;
                    this._lastPriority = priority;
                }

                this._priorityWeight += weight;
                var t = ( 1.0 - this._weight ) * weight / this._priorityWeight;
                this._target += ( val - this._target ) * t;
            } else {

                this._priorityWeight = weight;
                this._lastPriority = priority;
                this._target = val;
            }
        }
    } );

    return FloatTarget;
} );

define( 'osgAnimation/FloatLerpChannel',[
    'osgAnimation/Channel',
    'osgAnimation/Sampler',
    'osgAnimation/Interpolator',
    'osgAnimation/FloatTarget'
], function ( Channel, Sampler, Interpolator, FloatTarget ) {

    var FloatLerpChannel = function ( keys, target ) {
        var sampler = new Sampler();
        if ( !keys ) {
            keys = [];
        }
        if ( !target ) {
            target = new FloatTarget();
        }
        Channel.call( this, sampler, target );
        sampler.setInterpolator( Interpolator.FloatLerpInterpolator );
        this.setKeyframes( keys );
        this._data.value = target.getValue();
    };

    FloatLerpChannel.prototype = Channel.prototype;

    return FloatLerpChannel;
} );

define( 'osgAnimation/Keyframe',[], function () {

    var createVec3Keyframe = function ( t, array ) {
        var k = array.slice( 0 );
        k.t = t;
        return k;
    };

    var createQuatKeyframe = function ( t, array ) {
        var k = array.slice( 0 );
        k.t = t;
        return k;
    };

    var createFloatKeyframe = function ( t, value ) {
        var k = [ value ];
        k.t = t;
        return k;
    };

    return {
        createVec3Keyframe: createVec3Keyframe,
        createQuatKeyframe: createQuatKeyframe,
        createFloatKeyframe: createFloatKeyframe
    };
} );

define( 'osgAnimation/LinkVisitor',[
    'osg/Notify',
    'osg/Utils',
    'osg/NodeVisitor',
    'osg/Object',
    'osgAnimation/AnimationUpdateCallback'
], function ( Notify, MACROUTILS, NodeVisitor, Object, AnimationUpdateCallback ) {


    /**
     *  LinkVisitor search for animationUpdateCallback and link animation data
     *  @class LinkVisitor
     */
    var LinkVisitor = function () {
        NodeVisitor.call( this );
        this._animations = undefined;
        this._nbLinkTarget = 0;
    };

    /** @lends LinkVisitor.prototype */
    LinkVisitor.prototype = MACROUTILS.objectInehrit( NodeVisitor.prototype, {
        setAnimationMap: function ( anims ) {
            this._animations = anims;
            this._animationKeys = window.Object.keys( anims );
        },

        apply: function ( node ) {
            var cbs = node.getUpdateCallbackList();
            for ( var i = 0, l = cbs.length; i < l; i++ ) {
                var cb = cbs[ i ];
                if ( cb instanceof AnimationUpdateCallback ) {
                    this.link( cb );
                }
            }
            this.traverse( node );
        },

        link: function ( animCallback ) {
            var result = 0;
            var anims = this._animations;
            var animKeys = this._animationKeys;
            for ( var i = 0, l = animKeys.length; i < l; i++ ) {
                var key = animKeys[ i ];
                var anim = anims[ key ];
                result += animCallback.linkAnimation( anim );
            }
            this._nbLinkedTarget += result;
            Notify.info( 'linked ' + result + ' for "' + animCallback.getName() + '"' );
        }

    } );

    return LinkVisitor;
} );

define( 'osgAnimation/QuatTarget',[
    'osg/Utils',
    'osgAnimation/Target',
    'osg/Quat'
], function ( MACROUTILS, Target, Quat ) {


    var QuatTarget = function () {
        Target.call( this );
        this._target = Quat.create();
    };
    QuatTarget.prototype = MACROUTILS.objectInehrit( Target.prototype, {
        update: function ( weight, val, priority ) {
            if ( this._weight || this._priorityWeight ) {

                if ( this._lastPriority !== priority ) {
                    // change in priority
                    // add to weight with the same previous priority cumulated weight
                    this._weight += this._priorityWeight * ( 1.0 - this._weight );
                    this._priorityWeight = 0;
                    this._lastPriority = priority;
                }

                this._priorityWeight += weight;
                var t = ( 1.0 - this._weight ) * weight / this._priorityWeight;
                Quat.lerp( t, this._target, val, this._target );
                Quat.normalize( this._target, this._target );

            } else {

                this._priorityWeight = weight;
                this._lastPriority = priority;
                Quat.copy( val, this._target );
            }
        }
    } );

    return QuatTarget;
} );

define( 'osgAnimation/QuatLerpChannel',[
    'osgAnimation/Channel',
    'osgAnimation/Sampler',
    'osgAnimation/Interpolator',
    'osgAnimation/QuatTarget',
    'osg/Quat'
], function ( Channel, Sampler, Interpolator, QuatTarget, Quat ) {

    var QuatLerpChannel = function ( keys, target ) {
        var sampler = new Sampler();
        if ( !keys ) {
            keys = [];
        }
        if ( !target ) {
            target = new QuatTarget();
        }
        Channel.call( this, sampler, target );
        sampler.setInterpolator( Interpolator.QuatLerpInterpolator );
        this.setKeyframes( keys );
        this._data.value = Quat.copy( target.getValue(), Quat.create() );
    };

    QuatLerpChannel.prototype = Channel.prototype;

    return QuatLerpChannel;
} );

define( 'osgAnimation/QuatSlerpChannel',[
    'osgAnimation/Channel',
    'osgAnimation/QuatLerpChannel',
    'osgAnimation/Interpolator'
], function ( Channel, QuatLerpChannel, Interpolator ) {


    var QuatSlerpChannel = function ( keys, target ) {
        QuatLerpChannel.call( this, keys, target );
        this.getSampler().setInterpolator( Interpolator.QuatSlerpInterpolator );
    };

    QuatSlerpChannel.prototype = Channel.prototype;

    return QuatSlerpChannel;
} );

define( 'osgAnimation/StackedQuaternion',[
    'osg/Utils',
    'osg/Object',
    'osg/Matrix',
    'osgAnimation/QuatTarget',
    'osg/Quat'
], function ( MACROUTILS, Object, Matrix, QuatTarget, Quat ) {

    /**
     *  StackedQuaternion
     *  @class StackedQuaternion
     */
    var StackedQuaternion = function ( name, quat ) {
        Object.call( this );
        if ( !quat ) {
            quat = Quat.create();
        }
        this._quaternion = quat;
        this._target = undefined;
        this._matrixTmp = Matrix.create();
        this.setName( name );
    };

    /** @lends StackedQuaternion.prototype */
    StackedQuaternion.prototype = MACROUTILS.objectInehrit( Object.prototype, {
        setQuaternion: function ( q ) {
            Quat.copy( q, this._quaternion );
        },
        setTarget: function ( target ) {
            this._target = target;
        },
        getTarget: function () {
            return this._target;
        },
        update: function () {
            if ( this._target !== undefined ) {
                Quat.copy( this._target.getValue(), this._quaternion );
            }
        },
        getOrCreateTarget: function () {
            if ( !this._target ) {
                this._target = new QuatTarget( this._quaternion );
            }
            return this._target;
        },
        applyToMatrix: function ( m ) {
            var mtmp = this._matrixTmp;
            Matrix.setRotateFromQuat( mtmp, this._quaternion );
            Matrix.preMult( m, mtmp );
        }
    } );

    return StackedQuaternion;
} );

define( 'osgAnimation/Vec3Target',[
    'osg/Utils',
    'osgAnimation/Target',
    'osg/Vec3'
], function ( MACROUTILS, Target, Vec3 ) {

    var Vec3Target = function () {
        Target.call( this );
        this._target = [ 0, 0, 0 ];
    };
    Vec3Target.prototype = MACROUTILS.objectInehrit( Target.prototype, {
        update: function ( weight, val, priority ) {
            if ( this._weight || this._priorityWeight ) {

                if ( this._lastPriority !== priority ) {
                    // change in priority
                    // add to weight with the same previous priority cumulated weight
                    this._weight += this._priorityWeight * ( 1.0 - this._weight );
                    this._priorityWeight = 0;
                    this._lastPriority = priority;
                }

                this._priorityWeight += weight;
                var t = ( 1.0 - this._weight ) * weight / this._priorityWeight;
                Vec3.lerp( t, this._target, val, this._target );
            } else {

                this._priorityWeight = weight;
                this._lastPriority = priority;
                Vec3.copy( val, this._target );
            }
        }
    } );

    return Vec3Target;
} );

define( 'osgAnimation/StackedRotateAxis',[
    'osg/Utils',
    'osg/Object',
    'osg/Matrix',
    'osgAnimation/Vec3Target',
    'osgAnimation/FloatTarget',
    'osg/Vec3',
    'osg/Quat'
], function ( MACROUTILS, Object, Matrix, Vec3Target, FloatTarget, Vec3, Quat ) {


    /**
     *  StackedRotateAxis
     *  @class StackedRotateAxis
     */
    var StackedRotateAxis = function ( name, axis, angle ) {
        Object.call( this );
        if ( !axis ) {
            axis = [ 1.0, 0.0, 0.0 ];
        }
        if ( !angle ) {
            angle = 0.0;
        }
        this._axis = axis;
        this._angle = angle;
        this._target = undefined;
        this.setName( name );

        this._matrixTmp = Matrix.create();
        this._quatTmp = Matrix.create();
    };

    /** @lends StackedRotateAxis.prototype */
    StackedRotateAxis.prototype = MACROUTILS.objectInehrit( Object.prototype, {
        setAxis: function ( axis ) {
            Vec3.copy( axis, this._axis );
        },
        setAngle: function ( angle ) {
            this._angle = angle;
        },
        setTarget: function ( target ) {
            this._target = target;
        },
        getTarget: function () {
            return this._target;
        },
        update: function () {
            if ( this._target !== undefined ) {
                this._angle = this._target.getValue();
            }
        },
        getOrCreateTarget: function () {
            if ( !this._target ) {
                this._target = new FloatTarget( this._angle );
            }
            return this._target;
        },
        applyToMatrix: function ( m ) {
            var axis = this._axis;
            var qtmp = this._quatTmp;
            var mtmp = this._matrixTmp;

            Quat.makeRotate( this._angle, axis[ 0 ], axis[ 1 ], axis[ 2 ], qtmp );
            Matrix.setRotateFromQuat( mtmp, qtmp );
            Matrix.preMult( m, mtmp );
        }

    } );

    return StackedRotateAxis;
} );

define( 'osgAnimation/StackedTranslate',[
    'osg/Utils',
    'osg/Object',
    'osg/Matrix',
    'osgAnimation/Vec3Target',
    'osg/Vec3'
], function ( MACROUTILS, Object, Matrix, Vec3Target, Vec3 ) {


    /**
     *  StackedTranslate
     *  @class StackedTranslate
     */
    var StackedTranslate = function ( name, translate ) {
        Object.call( this );
        if ( !translate ) {
            translate = [ 0, 0, 0 ];
        }
        this._translate = translate;
        this._target = undefined;
        this.setName( name );
    };

    /** @lends StackedTranslate.prototype */
    StackedTranslate.prototype = MACROUTILS.objectInehrit( Object.prototype, {
        setTranslate: function ( translate ) {
            Vec3.copy( translate, this._translate );
        },
        setTarget: function ( target ) {
            this._target = target;
        },
        getTarget: function () {
            return this._target;
        },
        update: function () {
            if ( this._target !== undefined ) {
                Vec3.copy( this._target.getValue(), this._translate );
            }
        },
        getOrCreateTarget: function () {
            if ( !this._target ) {
                this._target = new Vec3Target( this._translate );
            }
            return this._target;
        },
        applyToMatrix: function ( m ) {
            Matrix.preMultTranslate( m, this._translate );
        }
    } );

    return StackedTranslate;
} );

define( 'osgAnimation/UpdateMatrixTransform',[
    'osg/Utils',
    'osg/Notify',
    'osg/Matrix',
    'osgAnimation/AnimationUpdateCallback'
], function ( MACROUTILS, Notify, Matrix, AnimationUpdateCallback ) {

    /**
     *  UpdateMatrixTransform
     *  @class UpdateMatrixTransform
     */
    var UpdateMatrixTransform = function () {
        AnimationUpdateCallback.call( this );
        this._stackedTransforms = [];
    };

    /** @lends AnimationUpdateCallback.prototype */
    UpdateMatrixTransform.prototype = MACROUTILS.objectInehrit( AnimationUpdateCallback.prototype, {
        getStackedTransforms: function () {
            return this._stackedTransforms;
        },
        update: function ( node /*, nv */ ) {

            // not optimized, we could avoid operation the animation did not change
            // the content of the transform element
            var matrix = node.getMatrix();
            Matrix.makeIdentity( matrix );
            var transforms = this._stackedTransforms;
            for ( var i = 0, l = transforms.length; i < l; i++ ) {
                var transform = transforms[ i ];
                transform.update();
                transform.applyToMatrix( matrix );
            }
            return true;
        },
        linkChannel: function ( channel ) {
            var channelName = channel.getName();
            var transforms = this._stackedTransforms;
            for ( var i = 0, l = transforms.length; i < l; i++ ) {
                var transform = transforms[ i ];
                var elementName = transform.getName();
                if ( channelName.length > 0 && elementName === channelName ) {
                    var target = transform.getOrCreateTarget();
                    if ( target ) {
                        channel.setTarget( target );
                        return true;
                    }
                }
            }
            Notify.log( 'can\'t link channel ' + channelName + ', does not contain a symbolic name that can be linked to TransformElements' );
            return false;
        }

    } );

    return UpdateMatrixTransform;
} );

define( 'osgAnimation/Vec3LerpChannel',[
    'osgAnimation/Channel',
    'osgAnimation/Sampler',
    'osgAnimation/Interpolator',
    'osgAnimation/Vec3Target',
    'osg/Vec3'
], function ( Channel, Sampler, Interpolator, Vec3Target, Vec3 ) {

    var Vec3LerpChannel = function ( keys, target ) {
        var sampler = new Sampler();
        if ( !keys ) {
            keys = [];
        }
        if ( !target ) {
            target = new Vec3Target();
        }
        Channel.call( this, sampler, target );
        sampler.setInterpolator( Interpolator.Vec3LerpInterpolator );
        this.setKeyframes( keys );
        this._data.value = Vec3.copy( target.getValue(), [] );
    };

    Vec3LerpChannel.prototype = Channel.prototype;

    return Vec3LerpChannel;
} );

define( 'osgAnimation/osgAnimation',[
	'osg/Utils',
	'osgAnimation/Animation',
	'osgAnimation/AnimationUpdateCallback',
	'osgAnimation/BasicAnimationManager',
	'osgAnimation/Channel',
	'osgAnimation/Easing',
	'osgAnimation/FloatLerpChannel',
	'osgAnimation/FloatTarget',
	'osgAnimation/Interpolator',
	'osgAnimation/Keyframe',
	'osgAnimation/LinkVisitor',
	'osgAnimation/QuatLerpChannel',
	'osgAnimation/QuatSlerpChannel',
	'osgAnimation/QuatTarget',
	'osgAnimation/Sampler',
	'osgAnimation/StackedQuaternion',
	'osgAnimation/StackedRotateAxis',
	'osgAnimation/StackedTranslate',
	'osgAnimation/Target',
	'osgAnimation/UpdateMatrixTransform',
	'osgAnimation/Vec3LerpChannel',
	'osgAnimation/Vec3Target'
], function ( MACROUTILS, Animation, AnimationUpdateCallback, BasicAnimationManager, Channel, Easing, FloatLerpChannel, FloatTarget, Interpolator, Keyframe, LinkVisitor, QuatLerpChannel, QuatSlerpChannel, QuatTarget, Sampler, StackedQuaternion, StackedRotateAxis, StackedTranslate, Target, UpdateMatrixTransform, Vec3LerpChannel, Vec3Target ) {

	var osgAnimation = {};

	osgAnimation.Animation = Animation;
	osgAnimation.AnimationUpdateCallback = AnimationUpdateCallback;
	osgAnimation.BasicAnimationManager = BasicAnimationManager;
	osgAnimation.Channel = Channel;
	MACROUTILS.objectMix( osgAnimation, Easing );
	osgAnimation.FloatLerpChannel = FloatLerpChannel;
	osgAnimation.FloatTarget = FloatTarget;
	MACROUTILS.objectMix( osgAnimation, Interpolator );
	MACROUTILS.objectMix( osgAnimation, Keyframe );
	osgAnimation.LinkVisitor = LinkVisitor;
	osgAnimation.QuatLerpChannel = QuatLerpChannel;
	osgAnimation.QuatSlerpChannel = QuatSlerpChannel;
	osgAnimation.QuatTarget = QuatTarget;
	osgAnimation.Sampler = Sampler;
	osgAnimation.StackedQuaternion = StackedQuaternion;
	osgAnimation.StackedRotateAxis = StackedRotateAxis;
	osgAnimation.StackedTranslate = StackedTranslate;
	osgAnimation.Target = Target;
	osgAnimation.UpdateMatrixTransform = UpdateMatrixTransform;
	osgAnimation.Vec3LerpChannel = Vec3LerpChannel;
	osgAnimation.Vec3Target = Vec3Target;

	return osgAnimation;
} );

define( 'osgWrappers/serializers/osg',[
    'Q'
], function ( Q ) {

    var osgWrapper = {};

    osgWrapper.Object = function ( input, obj ) {
        var jsonObj = input.getJSON();
        var check = function ( /*o*/ ) {
            return true;
        };
        if ( !check( jsonObj ) ) {
            return undefined;
        }

        if ( jsonObj.Name ) {
            obj.setName( jsonObj.Name );
        }

        if ( jsonObj.UserDataContainer ) {
            var userdata = input.setJSON( jsonObj.UserDataContainer ).readUserDataContainer();
            if ( userdata !== undefined ) {
                obj.setUserData( userdata );
            }
        }

        return obj;
    };

    osgWrapper.Node = function ( input, node ) {
        var jsonObj = input.getJSON();

        var check = function ( /*o*/ ) {
            return true;
        };
        if ( !check( jsonObj ) ) {
            return undefined;
        }

        osgWrapper.Object( input, node );

        var promiseArray = [];

        var createCallback = function ( jsonCallback ) {
            var promise = input.setJSON( jsonCallback ).readObject();
            var df = Q.defer();
            promiseArray.push( df.promise );
            Q.when( promise ).then( function ( cb ) {
                if ( cb ) {
                    node.addUpdateCallback( cb );
                }
                df.resolve();
            } );
        };

        if ( jsonObj.UpdateCallbacks ) {
            for ( var j = 0, l = jsonObj.UpdateCallbacks.length; j < l; j++ ) {
                createCallback( jsonObj.UpdateCallbacks[ j ] );
            }
        }


        if ( jsonObj.StateSet ) {
            var pp = input.setJSON( jsonObj.StateSet ).readObject();
            var df = Q.defer();
            promiseArray.push( df.promise );
            Q.when( pp ).then( function ( stateset ) {
                node.setStateSet( stateset );
                df.resolve();
            } );
        }

        var createChildren = function ( jsonChildren ) {
            var promise = input.setJSON( jsonChildren ).readObject();
            var df = Q.defer();
            promiseArray.push( df.promise );
            Q.when( promise ).then( function ( obj ) {
                if ( obj ) {
                    node.addChild( obj );
                }
                df.resolve( obj );
            } );
        };

        if ( jsonObj.Children ) {
            for ( var i = 0, k = jsonObj.Children.length; i < k; i++ ) {
                createChildren( jsonObj.Children[ i ] );
            }
        }

        var defer = Q.defer();
        Q.all( promiseArray ).then( function () {
            defer.resolve( node );
        } );

        return defer.promise;
    };

    osgWrapper.StateSet = function ( input, stateSet ) {
        var jsonObj = input.getJSON();
        var check = function ( /*o*/ ) {
            return true;
        };

        if ( !check( jsonObj ) ) {
            return;
        }

        osgWrapper.Object( input, stateSet );

        if ( jsonObj.RenderingHint !== undefined ) {
            stateSet.setRenderingHint( jsonObj.RenderingHint );
        }

        var createAttribute = function ( jsonAttribute ) {
            var promise = input.setJSON( jsonAttribute ).readObject();
            var df = Q.defer();
            promiseArray.push( df.promise );
            Q.when( promise ).then( function ( attribute ) {
                if ( attribute !== undefined ) {
                    stateSet.setAttributeAndMode( attribute );
                }
                df.resolve();
            } );
        };

        var promiseArray = [];

        if ( jsonObj.AttributeList !== undefined ) {
            for ( var i = 0, l = jsonObj.AttributeList.length; i < l; i++ ) {
                createAttribute( jsonObj.AttributeList[ i ] );
            }
        }

        var createTextureAttribute = function ( unit, textureAttribute ) {
            var promise = input.setJSON( textureAttribute ).readObject();
            var df = Q.defer();
            promiseArray.push( df.promise );
            Q.when( promise ).then( function ( attribute ) {
                if ( attribute )
                    stateSet.setTextureAttributeAndMode( unit, attribute );
                df.resolve();
            } );
        };

        if ( jsonObj.TextureAttributeList ) {
            var textures = jsonObj.TextureAttributeList;
            for ( var t = 0, lt = textures.length; t < lt; t++ ) {
                var textureAttributes = textures[ t ];
                for ( var a = 0, al = textureAttributes.length; a < al; a++ ) {
                    createTextureAttribute( t, textureAttributes[ a ] );
                }
            }
        }

        var defer = Q.defer();
        Q.all( promiseArray ).then( function () {
            defer.resolve( stateSet );
        } );

        return defer.promise;
    };

    osgWrapper.Material = function ( input, material ) {
        var jsonObj = input.getJSON();

        var check = function ( o ) {
            if ( o.Diffuse !== undefined &&
                o.Emission !== undefined &&
                o.Specular !== undefined &&
                o.Shininess !== undefined ) {
                return true;
            }
            return false;
        };

        if ( !check( jsonObj ) ) {
            return;
        }

        osgWrapper.Object( input, material );

        material.setAmbient( jsonObj.Ambient );
        material.setDiffuse( jsonObj.Diffuse );
        material.setEmission( jsonObj.Emission );
        material.setSpecular( jsonObj.Specular );
        material.setShininess( jsonObj.Shininess );
        return material;
    };


    osgWrapper.BlendFunc = function ( input, blend ) {
        var jsonObj = input.getJSON();
        var check = function ( o ) {
            if ( o.SourceRGB && o.SourceAlpha && o.DestinationRGB && o.DestinationAlpha ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return;
        }

        osgWrapper.Object( input, blend );

        blend.setSourceRGB( jsonObj.SourceRGB );
        blend.setSourceAlpha( jsonObj.SourceAlpha );
        blend.setDestinationRGB( jsonObj.DestinationRGB );
        blend.setDestinationAlpha( jsonObj.DestinationAlpha );
        return blend;
    };

    osgWrapper.CullFace = function ( input, attr ) {
        var jsonObj = input.getJSON();
        var check = function ( o ) {
            if ( o.Mode !== undefined ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return;
        }

        osgWrapper.Object( input, attr );
        attr.setMode( jsonObj.Mode );
        return attr;
    };

    osgWrapper.BlendColor = function ( input, attr ) {
        var jsonObj = input.getJSON();
        var check = function ( o ) {
            if ( o.ConstantColor !== undefined ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return;
        }

        osgWrapper.Object( input, attr );
        attr.setConstantColor( jsonObj.ConstantColor );
        return attr;
    };

    osgWrapper.Light = function ( input, light ) {
        var jsonObj = input.getJSON();
        var check = function ( o ) {
            if ( o.LightNum !== undefined &&
                o.Ambient !== undefined &&
                o.Diffuse !== undefined &&
                o.Direction !== undefined &&
                o.Position !== undefined &&
                o.Specular !== undefined &&
                o.SpotCutoff !== undefined &&
                o.LinearAttenuation !== undefined &&
                o.ConstantAttenuation !== undefined &&
                o.QuadraticAttenuation !== undefined ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return undefined;
        }

        osgWrapper.Object( input, light );
        light.setAmbient( jsonObj.Ambient );
        light.setConstantAttenuation( jsonObj.ConstantAttenuation );
        light.setDiffuse( jsonObj.Diffuse );
        light.setDirection( jsonObj.Direction );
        light.setLightNumber( jsonObj.LightNum );
        light.setLinearAttenuation( jsonObj.LinearAttenuation );
        light.setPosition( jsonObj.Position );
        light.setQuadraticAttenuation( jsonObj.QuadraticAttenuation );
        light.setSpecular( jsonObj.Specular );
        light.setSpotCutoff( jsonObj.SpotCutoff );
        light.setSpotBlend( 0.01 );
        if ( jsonObj.SpotExponent !== undefined ) {
            light.setSpotBlend( jsonObj.SpotExponent / 128.0 );
        }
        return light;
    };

    osgWrapper.Texture = function ( input, texture ) {
        var jsonObj = input.getJSON();
        var check = function ( /*o*/ ) {
            return true;
        };
        if ( !check( jsonObj ) ) {
            return undefined;
        }

        osgWrapper.Object( input, texture );

        if ( jsonObj.MinFilter !== undefined ) {
            texture.setMinFilter( jsonObj.MinFilter );
        }
        if ( jsonObj.MagFilter !== undefined ) {
            texture.setMagFilter( jsonObj.MagFilter );
        }

        if ( jsonObj.WrapT !== undefined ) {
            texture.setWrapT( jsonObj.WrapT );
        }
        if ( jsonObj.WrapS !== undefined ) {
            texture.setWrapS( jsonObj.WrapS );
        }

        // no file return dummy texture
        var file = jsonObj.File;
        if ( file === undefined ) {
            file = 'no-image-provided';
        }

        var defer = Q.defer();
        Q.when( input.readImageURL( file ) ).then(
            function ( img ) {
                texture.setImage( img );
                defer.resolve( texture );
            } );
        return defer.promise;
    };

    osgWrapper.Projection = function ( input, node ) {
        var jsonObj = input.getJSON();
        var check = function ( o ) {
            if ( o.Matrix !== undefined ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return;
        }

        var promise = osgWrapper.Node( input, node );

        if ( jsonObj.Matrix !== undefined ) {
            node.setMatrix( jsonObj.Matrix );
        }
        return promise;
    };

    osgWrapper.MatrixTransform = function ( input, node ) {
        var jsonObj = input.getJSON();
        var check = function ( o ) {
            if ( o.Matrix ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return undefined;
        }

        var promise = osgWrapper.Node( input, node );

        if ( jsonObj.Matrix !== undefined ) {
            node.setMatrix( jsonObj.Matrix );
        }
        return promise;
    };

    osgWrapper.LightSource = function ( input, node ) {
        var jsonObj = input.getJSON();
        var check = function ( o ) {
            if ( o.Light !== undefined ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return undefined;
        }

        var defer = Q.defer();
        var promise = osgWrapper.Node( input, node );
        Q.all( [ input.setJSON( jsonObj.Light ).readObject(), promise ] ).then( function ( args ) {
            var light = args[ 0 ];
            //var lightsource = args[ 1 ];
            node.setLight( light );
            defer.resolve( node );
        } );
        return defer.promise;
    };

    osgWrapper.Geometry = function ( input, node ) {
        var jsonObj = input.getJSON();
        var check = function ( o ) {
            if ( o.PrimitiveSetList !== undefined && o.VertexAttributeList !== undefined ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return;
        }

        var arraysPromise = [];
        arraysPromise.push( osgWrapper.Node( input, node ) );

        var createPrimitive = function ( jsonPrimitive ) {
            var defer = Q.defer();
            arraysPromise.push( defer.promise );
            var promise = input.setJSON( jsonPrimitive ).readPrimitiveSet();
            Q.when( promise ).then( function ( primitiveSet ) {
                if ( primitiveSet !== undefined ) {
                    node.getPrimitives().push( primitiveSet );
                }
                defer.resolve( primitiveSet );
            } );
        };

        for ( var i = 0, l = jsonObj.PrimitiveSetList.length; i < l; i++ ) {
            var entry = jsonObj.PrimitiveSetList[ i ];
            createPrimitive( entry );
        }

        var createVertexAttribute = function ( name, jsonAttribute ) {
            var defer = Q.defer();
            arraysPromise.push( defer.promise );
            var promise = input.setJSON( jsonAttribute ).readBufferArray();
            Q.when( promise ).then( function ( buffer ) {
                if ( buffer !== undefined ) {
                    node.getVertexAttributeList()[ name ] = buffer;
                }
                defer.resolve( buffer );
            } );
        };
        for ( var key in jsonObj.VertexAttributeList ) {
            if ( jsonObj.VertexAttributeList.hasOwnProperty( key ) ) {
                createVertexAttribute( key, jsonObj.VertexAttributeList[ key ] );
            }
        }

        var defer = Q.defer();
        Q.all( arraysPromise ).then( function () {
            defer.resolve( node );
        } );
        return defer.promise;
    };

    return osgWrapper;
} );

define( 'osgWrappers/serializers/osgAnimation',[
    'Q',
    'osg/Notify',
    'osgWrappers/serializers/osg'
], function ( Q, Notify, osgWrapper ) {

    var osgAnimationWrapper = {};

    osgAnimationWrapper.Animation = function ( input, animation ) {
        var jsonObj = input.getJSON();
        // check
        //
        var check = function ( o ) {
            if ( o.Name && o.Channels && o.Channels.length > 0 ) {
                return true;
            }
            if ( !o.Name ) {
                Notify.log( 'animation has field Name, error' );
                return false;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return undefined;
        }

        if ( !osgWrapper.Object( input, animation ) ) {
            return undefined;
        }

        var createPromiseCallback = function( animation ) {
            return function( chan ) {
                if ( chan ) {
                    animation.getChannels().push( chan );
                }
            };
        };
        // channels
        for ( var i = 0, l = jsonObj.Channels.length; i < l; i++ ) {
            Q.when( input.setJSON( jsonObj.Channels[ i ] ).readObject() ).then( createPromiseCallback( animation ) );
        }
        return animation;
    };

    osgAnimationWrapper.Vec3LerpChannel = function ( input, channel ) {
        var jsonObj = input.getJSON();
        // check
        //
        var check = function ( o ) {
            if ( o.KeyFrames && o.TargetName && o.Name ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return undefined;
        }

        // doit
        if ( !osgWrapper.Object( input, channel ) ) {
            return undefined;
        }

        channel.setTargetName( jsonObj.TargetName );

        // channels
        var keys = channel.getSampler().getKeyframes();
        for ( var i = 0, l = jsonObj.KeyFrames.length; i < l; i++ ) {
            var nodekey = jsonObj.KeyFrames[ i ];
            var mykey = nodekey.slice( 1 );
            mykey.t = nodekey[ 0 ];
            keys.push( mykey );
        }
        return channel;
    };

    osgAnimationWrapper.QuatLerpChannel = function ( input, channel ) {
        return osgAnimationWrapper.Vec3LerpChannel( input, channel );
    };

    osgAnimationWrapper.QuatSlerpChannel = function ( input, channel ) {
        return osgAnimationWrapper.Vec3LerpChannel( input, channel );
    };

    osgAnimationWrapper.FloatLerpChannel = function ( input, channel ) {
        var jsonObj = input.getJSON();
        // check
        //
        var check = function ( o ) {
            if ( o.KeyFrames && o.TargetName && o.Name ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return;
        }

        // doit
        if ( !osgWrapper.Object( input, channel ) ) {
            return;
        }

        channel.setTargetName( jsonObj.TargetName );

        // channels
        var keys = channel.getSampler().getKeyframes();
        for ( var i = 0, l = jsonObj.KeyFrames.length; i < l; i++ ) {
            var nodekey = jsonObj.KeyFrames[ i ];
            var mykey = nodekey.slice( 1 );
            mykey.t = nodekey[ 0 ];
            keys.push( mykey );
        }
        return channel;
    };

    osgAnimationWrapper.BasicAnimationManager = function ( input, manager ) {
        var jsonObj = input.getJSON();
        // check
        //
        var check = function ( o ) {
            if ( o.Animations ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return;
        }

        for ( var i = 0, l = jsonObj.Animations.length; i < l; i++ ) {
            var entry = jsonObj.Animations[ i ];
            var anim = input.setJSON( entry ).readObject();
            if ( anim ) {
                manager.registerAnimation( anim );
            }
        }
        return manager;
    };

    osgAnimationWrapper.UpdateMatrixTransform = function ( input, umt ) {
        var jsonObj = input.getJSON();
        // check
        var check = function ( o ) {
            if ( o.Name && o.StackedTransforms ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return;
        }

        if ( osgWrapper.Object( input, umt ) === undefined ) {
            return;
        }

        for ( var i = 0, l = jsonObj.StackedTransforms.length; i < l; i++ ) {
            var entry = jsonObj.StackedTransforms[ i ];
            var ste = input.setJSON( entry ).readObject();
            if ( ste ) {
                umt.getStackedTransforms().push( ste );
            }
        }
        return umt;
    };

    osgAnimationWrapper.StackedTranslate = function ( input, st ) {
        var jsonObj = input.getJSON();

        // check
        var check = function ( o ) {
            if ( o.Name ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return;
        }

        if ( !osgWrapper.Object( input, st ) ) {
            return;
        }

        if ( jsonObj.Translate ) {
            st.setTranslate( jsonObj.Translate );
        }
        return st;
    };

    osgAnimationWrapper.StackedQuaternion = function ( input, st ) {
        var jsonObj = input.getJSON();
        // check
        var check = function ( o ) {
            if ( o.Name ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return;
        }

        if ( !osgWrapper.Object( input, st ) ) {
            return;
        }

        if ( jsonObj.Quaternion ) {
            st.setQuaternion( jsonObj.Quaternion );
        }
        return st;
    };

    osgAnimationWrapper.StackedRotateAxis = function ( input, st ) {
        var jsonObj = input.getJSON();
        // check
        var check = function ( o ) {
            if ( o.Axis ) {
                return true;
            }
            return false;
        };
        if ( !check( jsonObj ) ) {
            return;
        }

        if ( !osgWrapper.Object( input, st ) ) {
            return;
        }

        if ( jsonObj.Angle ) {
            st.setAngle( jsonObj.Angle );
        }

        st.setAxis( jsonObj.Axis );

        return st;
    };

    return osgAnimationWrapper;
} );

define( 'osgDB/osgDB',[
    'osg/Utils',
    'osgDB/Input',
    'osgDB/ReaderParser',
    'osgWrappers/serializers/osg',
    'osgWrappers/serializers/osgAnimation'
], function ( MACROUTILS, Input, ReaderParser, osgWrappers, osgAnimationWrappers ) {


    var osgDB = {};
    osgDB.Input = Input;
    MACROUTILS.objectMix( osgDB, ReaderParser );
    osgDB.ObjectWrapper.serializers.osg = osgWrappers;
    osgDB.ObjectWrapper.serializers.osgAnimation = osgAnimationWrappers;

    return osgDB;
} );

define( 'Hammer',[],function ( ) {
    return window.Hammer;
} );

define( 'osgGA/Manipulator',[
    'osg/Matrix'
], function ( Matrix ) {

    /**
     *  Manipulator
     *  @class
     */
    var Manipulator = function () {
        this._controllerList = {};
        this._inverseMatrix = new Array( 16 );
        Matrix.makeIdentity( this._inverseMatrix );
    };

    /** @lends Manipulator.prototype */
    Manipulator.prototype = {

        // eg: var currentTime = nv.getFrameStamp().getSimulationTime();
        update: function ( /*nv*/ ) {},

        getInverseMatrix: function () {
            return this._inverseMatrix;
        },

        getControllerList: function () {
            return this._controllerList;
        }
    };

    return Manipulator;
} );

define( 'osgGA/OrbitManipulatorLeapMotionController',[
    'osg/Notify',
    'osg/Vec3'
], function ( Notify, Vec3 ) {

    var OrbitManipulatorLeapMotionController = function ( manipulator ) {
        this._manipulator = manipulator;
        this.init();
    };

    var ModeConfig = {
        'rotate': {
            dtx: -1.2 * 1.2,
            dty: -0.9 * 1.2,
            dtz: -0.1,
            delay: 0.05,
            method: 'getRotateInterpolator'
        },
        'pan': {
            dtx: -1.2 * 1.2,
            dty: -0.9 * 1.2,
            delay: 0.05,
            method: 'getPanInterpolator'
        },
        'zoom': {
            dtx: 0.0,
            dty: -0.5,
            delay: 0.05,
            method: 'getZoomInterpolator'
        },
        'zoom-twohands': {
            dtx: -0.05,
            dty: 0.0,
            delay: 0.05,
            method: 'getZoomInterpolator'
        }
    };

    OrbitManipulatorLeapMotionController.prototype = {
        init: function () {
            this._virtualCursor = [ 0.0, 0.0 ];
            this._targetPosition = [ 0.0, 0.0 ];
            this._previousFrame = undefined;
            this._displacement = [ 0.0, 0.0 ];
            this._top = [ 0, 1, 0 ];
            this._motion = [ 0.0, 0.0 ];
            this._delay = 0.05;
            this._threshold = 0.08;
            this._directionDotThreshold = 0.5;
            this._mode = 'rotate';
        },

        update: function ( frame ) {
            if ( !this._previousFrame ) {
                this._previousFrame = frame;
            }

            // no fingers ? return
            if ( frame.fingers.length === 0 ) {
                return;
            }

            var deltaFrame = this._previousFrame.translation( frame );

            this._previousFrame = frame;

            if ( frame.hands.length === 0 ) {
                return;
            }

            // filter noise
            if ( Math.abs( deltaFrame[ 0 ] ) < this._threshold &&
                Math.abs( deltaFrame[ 1 ] ) < this._threshold ) {
                return;
            }

            var mode = this._mode;
            var dist = 0;

            // scale is when there two hands with but with two hand with more than 1 fingers
            if ( frame.gestures.length > 0 ) {
                for ( var i = 0; i < frame.gestures.length; i++ ) {
                    var gesture = frame.gestures[ i ];
                    if ( gesture.type === 'circle' ) {
                        this._manipulator.computeHomePosition();
                        return;
                    }
                }
            }

            if ( frame.hands.length === 1 ) {
                if ( frame.hands[ 0 ].fingers.length >= 3 ) {
                    mode = 'zoom';
                    dist = frame.hands[ 0 ].palmPosition[ 1 ] / 10.0;
                    dist = Math.max( dist - 4, 0.01 );

                } else if ( frame.hands[ 0 ].fingers.length > 1 ) {
                    mode = 'pan';
                } else {
                    // by default onw hand moving means rotation
                    mode = 'rotate';
                }
            } else if ( frame.hands.length === 2 ) {
                var d0 = Math.abs( Vec3.dot( frame.hands[ 0 ].palmNormal, this._top ) ),
                    d1 = Math.abs( Vec3.dot( frame.hands[ 1 ].palmNormal, this._top ) );

                // two hands : zoom
                if ( d0 < this._directionDotThreshold && d1 < this._directionDotThreshold ) {
                    mode = 'zoom-twohands';
                } else {
                    // if hands flat do nothing
                    mode = undefined;
                    this._handsDistanceOld = undefined;
                }
            }
            var zoom = this._manipulator.getZoomInterpolator();

            if ( mode === undefined ) {
                return;
            }
            // change mode reset counter and skip this frame
            if ( mode !== this._mode ) {
                Notify.info( 'Switch to mode ' + mode );

                this._motion[ 0 ] = 0;
                this._motion[ 1 ] = 0;
                this._mode = mode;

                if ( mode === 'zoom' || mode === 'zoom-twohands' ) {
                    if ( zoom.isReset() ) {
                        zoom._start = 1.0;
                        zoom.set( 0.0 );
                    }
                }
                return;
            }

            var dtx, dty, dtz;
            dtx = ModeConfig[ mode ].dtx;
            dty = ModeConfig[ mode ].dty;
            dtz = ModeConfig[ mode ].dtz;

            this._motion[ 0 ] += deltaFrame[ 0 ] * dtx;
            this._motion[ 1 ] += deltaFrame[ 1 ] * dty;

            var delay = ModeConfig[ mode ].delay;

            // we use the mode enum to get the good method
            var method = ModeConfig[ mode ].method;
            this._manipulator[ method ]().setDelay( delay );

            if ( mode === 'zoom' ) {
                Notify.log( dist );
                zoom.setTarget( dist );
            } else if ( mode === 'zoom-twohands' ) { // two hands zoom
                // distance between two hands
                var handsDistance = Vec3.distance( frame.hands[ 0 ].palmPosition, frame.hands[ 1 ].palmPosition );

                if ( this._handsDistanceOld !== undefined ) {
                    // compare distance with lastframe and zoom if they get nearer, unzoom if they separate
                    var vel = dtx * ( handsDistance - this._handsDistanceOld );

                    dist = zoom._target;
                    dist[ 0 ] += vel;
                }
                this._handsDistanceOld = handsDistance;
            } else {
                if ( mode === 'rotate' ) {
                    dist = zoom._target[ 0 ];
                    dist += deltaFrame[ 2 ] * dtz;
                    dist = Math.max( dist, 0.01 );
                    zoom.setTarget( dist );
                }
                this._manipulator[ method ]().addTarget( this._motion[ 0 ], this._motion[ 1 ] );
            }

            this._motion[ 1 ] = this._motion[ 0 ] = 0;
        }
    };
    return OrbitManipulatorLeapMotionController;
} );

define( 'osgGA/OrbitManipulatorEnums',[], function () {

    return {
        ROTATE: 0,
        PAN: 1,
        ZOOM: 2
    };
} );

define( 'osgGA/OrbitManipulatorMouseKeyboardController',[
    'osgGA/OrbitManipulatorEnums'
], function ( OrbitManipulatorEnums ) {

    var OrbitManipulatorMouseKeyboardController = function ( manipulator ) {
        this._manipulator = manipulator;
        this.init();
    };

    OrbitManipulatorMouseKeyboardController.prototype = {
        init: function () {
            this.releaseButton();
            this._rotateKey = 65; // a
            this._zoomKey = 83; // s
            this._panKey = 68; // d

            this._mode = undefined;
            this._delay = 0.15;
        },
        getMode: function () {
            return this._mode;
        },
        setMode: function ( mode ) {
            this._mode = mode;
        },
        setEventProxy: function ( proxy ) {
            this._eventProxy = proxy;
        },
        setManipulator: function ( manipulator ) {
            this._manipulator = manipulator;
        },
        mousemove: function ( ev ) {
            if ( this._buttonup === true ) {
                return;
            }
            var pos = this._eventProxy.getPositionRelativeToCanvas( ev );
            var manipulator = this._manipulator;
            if ( isNaN( pos[ 0 ] ) === false && isNaN( pos[ 1 ] ) === false ) {

                var mode = this.getMode();
                if ( mode === OrbitManipulatorEnums.ROTATE ) {
                    manipulator.getRotateInterpolator().setDelay( this._delay );
                    manipulator.getRotateInterpolator().setTarget( pos[ 0 ], pos[ 1 ] );

                } else if ( mode === OrbitManipulatorEnums.PAN ) {
                    manipulator.getPanInterpolator().setTarget( pos[ 0 ], pos[ 1 ] );

                } else if ( mode === OrbitManipulatorEnums.ZOOM ) {
                    var zoom = manipulator.getZoomInterpolator();
                    if ( zoom.isReset() ) {
                        zoom._start = pos[ 1 ];
                        zoom.set( 0.0 );
                    }
                    var dy = pos[ 1 ] - zoom._start;
                    zoom._start = pos[ 1 ];
                    var v = zoom.getTarget()[ 0 ];
                    zoom.setTarget( v - dy / 20.0 );
                }
            }

            ev.preventDefault();
        },
        mousedown: function ( ev ) {
            var manipulator = this._manipulator;
            var mode = this.getMode();
            if ( mode === undefined ) {
                if ( ev.button === 0 ) {
                    if ( ev.shiftKey ) {
                        this.setMode( OrbitManipulatorEnums.PAN );
                    } else if ( ev.ctrlKey ) {
                        this.setMode( OrbitManipulatorEnums.ZOOM );
                    } else {
                        this.setMode( OrbitManipulatorEnums.ROTATE );
                    }
                } else {
                    this.setMode( OrbitManipulatorEnums.PAN );
                }
            }

            this.pushButton();

            var pos = this._eventProxy.getPositionRelativeToCanvas( ev );
            mode = this.getMode();
            if ( mode === OrbitManipulatorEnums.ROTATE ) {
                manipulator.getRotateInterpolator().reset();
                manipulator.getRotateInterpolator().set( pos[ 0 ], pos[ 1 ] );
            } else if ( mode === OrbitManipulatorEnums.PAN ) {
                manipulator.getPanInterpolator().reset();
                manipulator.getPanInterpolator().set( pos[ 0 ], pos[ 1 ] );
            } else if ( mode === OrbitManipulatorEnums.ZOOM ) {
                manipulator.getZoomInterpolator()._start = pos[ 1 ];
                manipulator.getZoomInterpolator().set( 0.0 );
            }
            ev.preventDefault();
        },
        mouseup: function ( /*ev */ ) {
            this.releaseButton();
            this.setMode( undefined );
        },
        mousewheel: function ( ev, intDelta /*, deltaX, deltaY */) {
            var manipulator = this._manipulator;
            ev.preventDefault();
            var zoomTarget = manipulator.getZoomInterpolator().getTarget()[ 0 ] - intDelta;
            manipulator.getZoomInterpolator().setTarget( zoomTarget );
        },

        pushButton: function () {
            this._buttonup = false;
        },
        releaseButton: function () {
            this._buttonup = true;
        },

        keydown: function ( ev ) {
            if ( ev.keyCode === 32 ) {
                this._manipulator.computeHomePosition();
                ev.preventDefault();

            } else if ( ev.keyCode === this._panKey &&
                this.getMode() !== OrbitManipulatorEnums.PAN ) {
                this.setMode( OrbitManipulatorEnums.PAN );
                this._manipulator.getPanInterpolator().reset();
                this.pushButton();
                ev.preventDefault();
            } else if ( ev.keyCode === this._zoomKey &&
                this.getMode() !== OrbitManipulatorEnums.ZOOM ) {
                this.setMode( OrbitManipulatorEnums.ZOOM );
                this._manipulator.getZoomInterpolator().reset();
                this.pushButton();
                ev.preventDefault();
            } else if ( ev.keyCode === this._rotateKey &&
                this.getMode() !== OrbitManipulatorEnums.ROTATE ) {
                this.setMode( OrbitManipulatorEnums.ROTATE );
                this._manipulator.getRotateInterpolator().reset();
                this.pushButton();
                ev.preventDefault();
            }

        },

        keyup: function ( ev ) {
            if ( ev.keyCode === this._panKey ) {
                this.mouseup( ev );
            } else if ( ev.keyCode === this._rotateKey ) {
                this.mouseup( ev );
            } else if ( ev.keyCode === this._rotateKey ) {
                this.mouseup( ev );
            }
            this.setMode( undefined );
        }

    };
    return OrbitManipulatorMouseKeyboardController;
} );

define( 'osgGA/OrbitManipulatorHammerController',[
    'osg/Notify'
], function ( Notify ) {

    var OrbitManipulatorHammerController = function ( manipulator ) {
        this._manipulator = manipulator;
        this.init();
    };

    OrbitManipulatorHammerController.prototype = {
        init: function () {
            this._panFactorX = 0.5;
            this._panFactorY = -this._panFactorX;

            this._rotateFactorX = 0.6;
            this._rotateFactorY = -this._rotateFactorX;
            this._zoomFactor = 5.0;

            this._pan = false;
            this._delay = 0.15;
        },
        setEventProxy: function ( proxy ) {
            if ( proxy === undefined || ( proxy !== undefined && proxy === this._eventProxy ) ) {
                return;
            }
            this._eventProxy = proxy;
            var self = this;
            var hammer = proxy;

            var computeTouches = function ( gesture ) {
                if ( gesture.touches !== undefined )
                    return gesture.touches.length;
                return 1; // mouse
            };

            var dragCB = function ( ev ) {
                return 'touches ' + computeTouches( ev ) + ' distance ' + ev.distance + ' x ' + ev.deltaX + ' y ' + ev.deltaY;
            };

            hammer.on( 'dragstart', function ( event ) {
                var manipulator = self._manipulator;
                if ( !manipulator || self._transformStarted ) {
                    return;
                }
                var gesture = event.gesture;
                if ( computeTouches( gesture ) === 2 ) {
                    self._pan = true;
                }

                self._dragStarted = true;
                if ( self._pan ) {
                    manipulator.getPanInterpolator().reset();
                    manipulator.getPanInterpolator().set( gesture.center.pageX * self._panFactorX, gesture.center.pageY * self._panFactorY );
                } else {
                    manipulator.getRotateInterpolator().reset();
                    manipulator.getRotateInterpolator().set( gesture.center.pageX * self._rotateFactorX, gesture.center.pageY * self._rotateFactorY );
                }
                Notify.debug( 'drag start, ' + dragCB( gesture ) );
            } );

            hammer.on( 'drag', function ( event ) {
                var manipulator = self._manipulator;
                if ( !manipulator ) {
                    return;
                }
                if ( !self._dragStarted ) {
                    return;
                }
                if ( self._transformStarted ) {
                    self._dragStarted = false;
                    return;
                }

                var gesture = event.gesture;
                if ( self._pan ) {

                    // if a pan started and we release one finger,
                    // we dont take care of the those event
                    if ( computeTouches( gesture ) !== 2 )
                        return;

                    manipulator.getPanInterpolator().setTarget( gesture.center.pageX * self._panFactorX, gesture.center.pageY * self._panFactorY );
                    Notify.debug( 'pad, ' + dragCB( gesture ) );
                } else {
                    manipulator.getRotateInterpolator().setDelay( self._delay );
                    manipulator.getRotateInterpolator().setTarget( gesture.center.pageX * self._rotateFactorX, gesture.center.pageY * self._rotateFactorY );
                    Notify.debug( 'rotate, ' + dragCB( gesture ) );
                }
            } );
            hammer.on( 'dragend', function ( event ) {
                var manipulator = self._manipulator;
                if ( !manipulator || !self._dragStarted ) {
                    return;
                }
                self._dragStarted = false;
                var gesture = event.gesture;
                self._pan = false;
                Notify.debug( 'drag end, ' + dragCB( gesture ) );
            } );

            var toucheScale;
            hammer.on( 'transformstart', function ( event ) {
                var manipulator = self._manipulator;
                if ( !manipulator ) {
                    return;
                }
                self._transformStarted = true;
                var gesture = event.gesture;

                toucheScale = gesture.scale;
                var scale = gesture.scale;
                manipulator.getZoomInterpolator().reset();
                manipulator.getZoomInterpolator().set( gesture.scale );

                Notify.debug( 'transform start ' + gesture.scale + ' ' + scale );
                event.preventDefault();
                hammer.options.drag = false;
            } );
            hammer.on( 'transformend', function ( event ) {
                self._transformStarted = false;
                Notify.debug( 'transform end ' + event.gesture.scale );
                hammer.options.drag = true;

            } );
            hammer.on( 'transform', function ( event ) {
                var manipulator = self._manipulator;
                if ( !manipulator || !self._transformStarted ) {
                    return;
                }

                var gesture = event.gesture;

                var scale = ( gesture.scale - toucheScale ) * self._zoomFactor;
                toucheScale = gesture.scale;
                var target = manipulator.getZoomInterpolator().getTarget()[ 0 ];
                manipulator.getZoomInterpolator().setTarget( target - scale );
                Notify.debug( 'transform ' + gesture.scale + ' ' + ( target - scale ) );
            } );

        },
        setManipulator: function ( manipulator ) {
            this._manipulator = manipulator;
        }
    };
    return OrbitManipulatorHammerController;
} );

define( 'osgGA/OrbitManipulatorGamePadController',[], function () {

    var OrbitManipulatorGamePadController = function ( manipulator ) {
        this._manipulator = manipulator;
        this.init();
    };

    OrbitManipulatorGamePadController.prototype = {
        init: function () {
            this._delay = 0.15;
            this._threshold = 0.08;
            this._mode = 0;
            this._padFactor = 10.0;
            this._zoomFactor = 0.5;
            this._rotateFactor = 5.0;
        },


        addPan: function ( pan, x, y ) {
            pan.setDelay( this._delay );
            pan.addTarget( x * this._padFactor, y * this._padFactor );
        },

        addZoom: function ( zoom, z ) {
            zoom.setDelay( this._delay );
            zoom.addTarget( z * this._zoomFactor );
        },

        addRotate: function ( rotate, x, y ) {
            rotate.setDelay( this._delay );
            //var rotateTarget = rotate.getTarget();
            rotate.addTarget( x * this._rotateFactor, y * this._rotateFactor );
        },

        gamepadaxes: function ( axes ) {

            // Block badly balanced controllers
            var AXIS_THRESHOLD = 0.005;

            //var rotateTarget, panTarget;
            var rotate = this._manipulator.getRotateInterpolator();
            var zoom = this._manipulator.getZoomInterpolator();
            var pan = this._manipulator.getPanInterpolator();
            // Regular gamepads
            if ( axes.length === 4 ) {

                if ( Math.abs( axes[ 0 ] ) > AXIS_THRESHOLD || Math.abs( axes[ 1 ] ) > AXIS_THRESHOLD ) {
                    this.addRotate( rotate, -axes[ 0 ], axes[ 1 ] );
                }
                if ( Math.abs( axes[ 3 ] ) > AXIS_THRESHOLD ) {
                    this.addZoom( zoom, -axes[ 3 ] );
                }

                //SpaceNavigator & 6-axis controllers
            } else if ( axes.length >= 5 ) {
                //Notify.log(axes);
                if ( Math.abs( axes[ 0 ] ) > AXIS_THRESHOLD || Math.abs( axes[ 1 ] ) > AXIS_THRESHOLD ) {
                    this.addPan( pan, -axes[ 0 ], axes[ 1 ] );
                }

                if ( Math.abs( axes[ 2 ] ) > AXIS_THRESHOLD ) {
                    this.addZoom( zoom, -axes[ 2 ] );
                }

                if ( Math.abs( axes[ 3 ] ) > AXIS_THRESHOLD || Math.abs( axes[ 4 ] ) > AXIS_THRESHOLD ) {
                    this.addRotate( rotate, axes[ 4 ], axes[ 3 ] );
                }
            }

        },

        gamepadbuttondown: function ( event /*, pressed */ ) {
            // Buttons 12 to 15 are the d-pad.
            if ( event.button >= 12 && event.button <= 15 ) {
                var pan = this._manipulator.getPanInterpolator();
                var panTarget = pan.getTarget();
                var delta = {
                    12: [ 0, -1 ],
                    13: [ 0, 1 ],
                    14: [ -1, 0 ],
                    15: [ 1, 0 ]
                }[ event.button ];
                pan.setDelay( this._delay );
                pan.setTarget( panTarget[ 0 ] - delta[ 0 ] * 10, panTarget[ 1 ] + delta[ 1 ] * 10 );
            }
        },

        update: function ( gamepadProxyEvent ) {
            if ( !gamepadProxyEvent ) {
                return;
            }

            var gm = gamepadProxyEvent.getGamePad();
            var axis = gm.axes;
            var buttons = gm.buttons;

            this.gamepadaxes( axis );

            // Dummy event wrapper
            var emptyFunc = function () {};
            for ( var i = 0; i < buttons.length; i++ ) {
                if ( buttons[ i ] ) {
                    this.gamepadbuttondown( {
                        preventDefault: emptyFunc,
                        gamepad: gm,
                        button: i
                    }, !! buttons[ i ] );
                }
            }
        }
    };
    return OrbitManipulatorGamePadController;
} );

define( 'osgGA/OrbitManipulator',[
    'osg/Utils',
    'osg/Vec3',
    'osg/Matrix',
    'osgGA/Manipulator',
    'osgGA/OrbitManipulatorLeapMotionController',
    'osgGA/OrbitManipulatorMouseKeyboardController',
    'osgGA/OrbitManipulatorHammerController',
    'osgGA/OrbitManipulatorGamePadController'
], function ( MACROUTILS, Vec3, Matrix, Manipulator, OrbitManipulatorLeapMotionController, OrbitManipulatorMouseKeyboardController, OrbitManipulatorHammerController, OrbitManipulatorGamePadController ) {

    /**
     *  OrbitManipulator
     *  @class
     */
    var OrbitManipulator = function () {
        Manipulator.call( this );
        this._homePosition = [ 0.0, 0.0, 0.0 ];
        this.init();
    };

    OrbitManipulator.Interpolator = function ( size, delay ) {
        this._current = new Array( size );
        this._target = new Array( size );
        this._delta = new Array( size );
        this._delay = ( delay !== undefined ) ? delay : 0.15;
        this._reset = false;
        this.reset();
    };
    OrbitManipulator.Interpolator.prototype = {
        setDelay: function ( delay ) {
            this._delay = delay;
        },
        reset: function () {
            for ( var i = 0, l = this._current.length; i < l; i++ ) {
                this._current[ i ] = this._target[ i ] = 0;
            }
            this._reset = true;
        },
        update: function () {
            for ( var i = 0, l = this._current.length; i < l; i++ ) {
                var d = ( this._target[ i ] - this._current[ i ] ) * this._delay;
                this._delta[ i ] = d;
                this._current[ i ] += d;
            }
            return this._delta;
        },
        set: function () {
            for ( var i = 0, l = this._current.length; i < l; i++ ) {
                this._current[ i ] = this._target[ i ] = arguments[ i ];
            }
            this._reset = false;
        },
        isReset: function () {
            return this._reset;
        },
        getCurrent: function () {
            return this._current;
        },
        setTarget: function () {
            for ( var i = 0, l = this._target.length; i < l; i++ ) {
                if ( this._reset ) {
                    this._target[ i ] = this._current[ i ] = arguments[ i ];
                } else {
                    this._target[ i ] = arguments[ i ];
                }
            }
            this._reset = false;
        },
        addTarget: function () {
            for ( var i = 0; i < arguments.length; i++ ) {
                this._target[ i ] += arguments[ i ];
            }
        },
        getTarget: function () {
            return this._target;
        },
        getDelta: function () {
            return this._delta;
        }
    };

    OrbitManipulator.AvailableControllerList = [ 'StandardMouseKeyboard',
        'LeapMotion',
        'GamePad',
        'Hammer'
    ];

    OrbitManipulator.ControllerList = [ 'StandardMouseKeyboard',
        'LeapMotion',
        'GamePad',
        'Hammer'
    ];

    /** @lends OrbitManipulator.prototype */
    OrbitManipulator.prototype = MACROUTILS.objectInehrit( Manipulator.prototype, {
        init: function () {
            this._distance = 25.0;
            this._target = [ 0.0, 0.0, 0.0 ];
            this._upz = [ 0.0, 0.0, 1.0 ];
            Vec3.init( this._target );

            var rot1 = Matrix.makeRotate( Math.PI, 0.0, 0.0, 1.0, Matrix.create() );
            var rot2 = Matrix.makeRotate( -Math.PI / 10.0, 1.0, 0.0, 0.0, Matrix.create() );
            this._rotation = Matrix.create();
            Matrix.mult( rot1, rot2, this._rotation );
            this._time = 0.0;

            this._rotate = new OrbitManipulator.Interpolator( 2 );
            this._pan = new OrbitManipulator.Interpolator( 2 );
            this._zoom = new OrbitManipulator.Interpolator( 1 );
            this._zoom.reset = function () {
                OrbitManipulator.Interpolator.prototype.reset.call( this );
                this._start = 0.0;
            };

            this._buttonup = true;

            this._scale = 10.0;
            this._maxDistance = 0.0;
            this._minDistance = 0.0;
            this._scaleMouseMotion = 1.0;

            this._inverseMatrix = Matrix.create();
            this._rotateKey = 65; // a
            this._zoomKey = 83; // s
            this._panKey = 68; // d

            // instance of controller
            var self = this;

            OrbitManipulator.ControllerList.forEach( function ( value ) {
                if ( OrbitManipulator[ value ] !== undefined ) {
                    self._controllerList[ value ] = new OrbitManipulator[ value ]( self );
                }
            } );
        },
        reset: function () {
            this.init();
        },
        setNode: function ( node ) {
            this._node = node;
        },
        setTarget: function ( target ) {
            Vec3.copy( target, this._target );
            var eyePos = [ 0.0, 0.0, 0.0 ];
            this.getEyePosition( eyePos );
            this._distance = Vec3.distance( eyePos, target );
        },
        setEyePosition: ( function () {
            var f = [ 0.0, 0.0, 0.0 ];
            var s = [ 0.0, 0.0, 0.0 ];
            var u = [ 0.0, 0.0, 0.0 ];
            return function ( eye ) {
                var result = this._rotation;
                var center = this._target;

                Vec3.sub( eye, center, f );
                Vec3.normalize( f, f );

                Vec3.cross( f, this._upz, s );
                Vec3.normalize( s, s );

                Vec3.cross( s, f, u );
                Vec3.normalize( u, u );

                // s[0], f[0], u[0], 0.0,
                // s[1], f[1], u[1], 0.0,
                // s[2], f[2], u[2], 0.0,
                // 0,    0,    0,     1.0
                result[ 0 ] = s[ 0 ];
                result[ 1 ] = f[ 0 ];
                result[ 2 ] = u[ 0 ];
                result[ 3 ] = 0.0;
                result[ 4 ] = s[ 1 ];
                result[ 5 ] = f[ 1 ];
                result[ 6 ] = u[ 1 ];
                result[ 7 ] = 0.0;
                result[ 8 ] = s[ 2 ];
                result[ 9 ] = f[ 2 ];
                result[ 10 ] = u[ 2 ];
                result[ 11 ] = 0.0;
                result[ 12 ] = 0;
                result[ 13 ] = 0;
                result[ 14 ] = 0;
                result[ 15 ] = 1.0;

                this._distance = Vec3.distance( eye, center );
            };
        } )(),
        computeHomePosition: function () {
            if ( this._node !== undefined ) {
                //this.reset();
                var bs = this._node.getBound();
                this.setDistance( bs.radius() * 1.5 );
                this.setTarget( bs.center() );
            }
        },

        getHomePosition: function () {
            if ( this._node !== undefined ) {
                var bs = this._node.getBound();
                var distance = bs.radius() * 1.5;

                var target = bs.center();

                this.computeEyePosition( target, distance, this._homePosition );
            }
            return this._homePosition;
        },

        setMaxDistance: function ( d ) {
            this._maxDistance = d;
        },
        setMinDistance: function ( d ) {
            this._minDistance = d;
        },
        setDistance: function ( d ) {
            this._distance = d;
        },
        getDistance: function () {
            return this._distance;
        },
        computePan: ( function () {
            var inv = Matrix.create();
            var x = [ 0.0, 0.0, 0.0 ];
            var y = [ 0.0, 0.0, 0.0 ];
            return function ( dx, dy ) {
                dy *= this._distance;
                dx *= this._distance;
                Matrix.inverse( this._rotation, inv );
                x[ 0 ] = Matrix.get( inv, 0, 0 );
                x[ 1 ] = Matrix.get( inv, 0, 1 );
                x[ 2 ] = Matrix.get( inv, 0, 2 );
                Vec3.normalize( x, x );

                y[ 0 ] = Matrix.get( inv, 2, 0 );
                y[ 1 ] = Matrix.get( inv, 2, 1 );
                y[ 2 ] = Matrix.get( inv, 2, 2 );
                Vec3.normalize( y, y );

                Vec3.mult( x, -dx, x );
                Vec3.mult( y, dy, y );
                Vec3.add( this._target, x, this._target );
                Vec3.add( this._target, y, this._target );
            };
        } )(),
        computeRotation: ( function () {
            var of = Matrix.create();
            var r = Matrix.create();
            var r2 = Matrix.create();
            var inv = Matrix.create();
            var tmp = [ 0.0, 0.0, 0.0 ];
            var tmpDist = [ 0.0, 0.0, 0.0 ];
            return function ( dx, dy ) {
                Matrix.makeRotate( dx / 10.0, 0.0, 0.0, 1.0, of );
                Matrix.mult( this._rotation, of, r );

                Matrix.makeRotate( dy / 10.0, 1.0, 0.0, 0.0, of );
                Matrix.mult( of, r, r2 );

                // test that the eye is not too up and not too down to not kill
                // the rotation matrix
                Matrix.inverse( r2, inv );
                tmpDist[ 1 ] = this._distance;
                Matrix.transformVec3( inv, tmpDist, tmp );

                Vec3.neg( tmp, tmp );
                Vec3.normalize( tmp, tmp );

                var p = Vec3.dot( tmp, this._upz );
                if ( Math.abs( p ) > 0.95 ) {
                    //discard rotation on y
                    Matrix.copy( r, this._rotation );
                    return;
                }
                Matrix.copy( r2, this._rotation );
            };
        } )(),
        computeZoom: function ( dz ) {
            this.zoom( dz );
        },

        zoom: function ( ratio ) {
            var newValue = this._distance * ratio;
            if ( this._minDistance > 0.0 ) {
                if ( newValue < this._minDistance ) {
                    newValue = this._minDistance;
                }
            }
            if ( this._maxDistance > 0.0 ) {
                if ( newValue > this._maxDistance ) {
                    newValue = this._maxDistance;
                }
            }
            this._distance = newValue;
        },

        getRotateInterpolator: function () {
            return this._rotate;
        },
        getPanInterpolator: function () {
            return this._pan;
        },
        getZoomInterpolator: function () {
            return this._zoom;
        },
        getTarget: function ( target ) {
            Vec3.copy( this._target, target );
            return target;
        },
        getEyePosition: function ( eye ) {
            this.computeEyePosition( this._target, this._distance, eye );
        },

        computeEyePosition: ( function () {
            var tmpDist = [ 0.0, 0.0, 0.0 ];
            var tmpInverse = Matrix.create();
            return function ( target, distance, eye ) {
                Matrix.inverse( this._rotation, tmpInverse );
                tmpDist[ 1 ] = distance;
                Matrix.transformVec3( tmpInverse, tmpDist, eye );
                Vec3.add( target, eye, eye );
            };
        } )(),

        update: ( function () {
            var eye = [ 0.0, 0.0, 0.0 ];
            var tmpDist = [ 0.0, 0.0, 0.0 ];
            return function ( nv ) {
                var t = nv.getFrameStamp().getSimulationTime();
                if ( this._lastUpdate === undefined ) {
                    this._lastUpdate = t;
                }
                //var dt = t - this._lastUpdate;
                this._lastUpdate = t;

                var delta;
                var mouseFactor = 0.1;
                delta = this._rotate.update();
                this.computeRotation( -delta[ 0 ] * mouseFactor * this._scaleMouseMotion, -delta[ 1 ] * mouseFactor * this._scaleMouseMotion );


                var panFactor = 0.002;
                delta = this._pan.update();
                this.computePan( -delta[ 0 ] * panFactor, -delta[ 1 ] * panFactor );


                delta = this._zoom.update();
                this.computeZoom( 1.0 + delta[ 0 ] / 10.0 );

                var target = this._target;
                var distance = this._distance;

                Matrix.inverse( this._rotation, this._inverseMatrix );
                tmpDist[ 1 ] = distance;
                Matrix.transformVec3( this._inverseMatrix, tmpDist, eye );

                Matrix.makeLookAt( Vec3.add( target, eye, eye ), target, this._upz, this._inverseMatrix );
            };
        } )(),

        getInverseMatrix: function () {
            return this._inverseMatrix;
        }
    } );

    ( function ( module ) {
        module.LeapMotion = OrbitManipulatorLeapMotionController;
    } )( OrbitManipulator );


    ( function ( module ) {
        module.StandardMouseKeyboard = OrbitManipulatorMouseKeyboardController;
    } )( OrbitManipulator );


    ( function ( module ) {
        module.Hammer = OrbitManipulatorHammerController;
    } )( OrbitManipulator );

    ( function ( module ) {
        module.GamePad = OrbitManipulatorGamePadController;
    } )( OrbitManipulator );

    return OrbitManipulator;
} );

define( 'osgGA/FirstPersonManipulatorMouseKeyboardController',[], function () {

    var FirstPersonManipulatorMouseKeyboardController = function ( manipulator ) {
        this._manipulator = manipulator;
        this.init();
    };

    FirstPersonManipulatorMouseKeyboardController.prototype = {
        init: function () {
            this.releaseButton();
            this._delay = 0.15;
            this._stepFactor = 1.0; // meaning radius*stepFactor to move
        },
        setEventProxy: function ( proxy ) {
            this._eventProxy = proxy;
        },
        setManipulator: function ( manipulator ) {
            this._manipulator = manipulator;

            // we always want to sync speed of controller with manipulator
            this._manipulator.setStepFactor( this._stepFactor );
        },

        pushButton: function () {
            this._buttonup = false;
        },
        releaseButton: function () {
            this._buttonup = true;
        },

        mousedown: function ( ev ) {
            var pos = this._eventProxy.getPositionRelativeToCanvas( ev );
            var manipulator = this._manipulator;
            manipulator.getLookPositionInterpolator().set( pos[ 0 ], pos[ 1 ] );
            this.pushButton();
        },
        mouseup: function ( /*ev */ ) {
            this.releaseButton();
        },
        mousemove: function ( ev ) {
            if ( this._buttonup === true ) {
                return;
            }

            var pos = this._eventProxy.getPositionRelativeToCanvas( ev );
            this._manipulator.getLookPositionInterpolator().setDelay( this._delay );
            this._manipulator.getLookPositionInterpolator().setTarget( pos[ 0 ], pos[ 1 ] );
        },
        mousewheel: function ( ev, intDelta /*, deltaX, deltaY */ ) {
            ev.preventDefault();
            this._stepFactor = Math.min( Math.max( 0.001, this._stepFactor + intDelta * 0.01 ), 4.0 );
            this._manipulator.setStepFactor( this._stepFactor );
        },

        keydown: function ( event ) {
            var manipulator = this._manipulator;
            if ( event.keyCode === 32 ) {
                manipulator.computeHomePosition();
            } else if ( event.keyCode === 87 || event.keyCode === 90 || event.keyCode === 38 ) { // w/z/up
                manipulator.getFowardInterpolator().setDelay( this._delay );
                manipulator.getFowardInterpolator().setTarget( 1 );
                return false;
            } else if ( event.keyCode === 83 || event.keyCode === 40 ) { // S/down
                manipulator.getFowardInterpolator().setDelay( this._delay );
                manipulator.getFowardInterpolator().setTarget( -1 );
                return false;
            } else if ( event.keyCode === 68 || event.keyCode === 39 ) { // D/right
                manipulator.getSideInterpolator().setDelay( this._delay );
                manipulator.getSideInterpolator().setTarget( 1 );
                return false;
            } else if ( event.keyCode === 65 || event.keyCode === 81 || event.keyCode === 37 ) { // a/q/left
                manipulator.getSideInterpolator().setDelay( this._delay );
                manipulator.getSideInterpolator().setTarget( -1 );
                return false;
            }
            return undefined;
        },

        keyup: function ( event ) {
            var manipulator = this._manipulator;
            if ( event.keyCode === 87 || event.keyCode === 90 || event.keyCode === 38 || // w/z/up
                event.keyCode === 83 || event.keyCode === 40 ) { // S/down
                manipulator.getFowardInterpolator().setDelay( this._delay );
                manipulator.getFowardInterpolator().setTarget( 0 );
                return false;
            } else if ( event.keyCode === 68 || event.keyCode === 39 || // D/right
                event.keyCode === 65 || event.keyCode === 81 || event.keyCode === 37 ) { // a/q/left
                manipulator.getSideInterpolator().setDelay( this._delay );
                manipulator.getSideInterpolator().setTarget( 0 );
                return false;
            }
            return undefined;
        }

    };

    return FirstPersonManipulatorMouseKeyboardController;
} );

define( 'osgGA/FirstPersonManipulatorOculusController',[], function () {

    var FirstPersonManipulatorOculusController = function ( manipulator ) {
        this._manipulator = manipulator;
        this.init();
    };

    FirstPersonManipulatorOculusController.prototype = {
        init: function () {
            this._stepFactor = 1.0; // meaning radius*stepFactor to move
        },
        update: function ( rot ) {
            // On oculus the up vector is [0,1,0]
            // On osgjs the up vector is [0,0,1]
            this._manipulator.setRotationBaseFromQuat( [ rot[ 0 ], -rot[ 2 ], rot[ 1 ], rot[ 3 ] ] );
        },

    };

    return FirstPersonManipulatorOculusController;
} );
define( 'osgGA/FirstPersonManipulator',[
    'osg/Utils',
    'osgGA/Manipulator',
    'osgGA/OrbitManipulator',
    'osg/Matrix',
    'osg/Vec2',
    'osg/Vec3',
    'osgGA/FirstPersonManipulatorMouseKeyboardController',
    'osgGA/FirstPersonManipulatorOculusController'
], function ( MACROUTILS, Manipulator, OrbitManipulator, Matrix, Vec2, Vec3, FirstPersonManipulatorMouseKeyboardController, FirstPersonManipulatorOculusController ) {

    /**
     * Authors:
     *  Matt Fontaine <tehqin@gmail.com>
     *  Cedric Pinson <trigrou@gmail.com>
     */

    /**
     *  FirstPersonManipulator
     *  @class
     */
    var FirstPersonManipulator = function () {
        Manipulator.call( this );
        this.init();
    };

    FirstPersonManipulator.AvailableControllerList = [ 'StandardMouseKeyboard', 'Oculus'];
    FirstPersonManipulator.ControllerList = [ 'StandardMouseKeyboard', 'Oculus' ];

    /** @lends FirstPersonManipulator.prototype */
    FirstPersonManipulator.prototype = MACROUTILS.objectInehrit( Manipulator.prototype, {
        setNode: function ( node ) {
            this._node = node;
            this.computeHomePosition();
        },
        computeHomePosition: function () {
            if ( this._node !== undefined ) {
                var bs = this._node.getBound();
                this._radius = bs.radius();
                var eye = this._eye;
                eye[ 0 ] = 0.0;
                eye[ 1 ] = -bs.radius();
                eye[ 2 ] = 0.0;
            }
        },
        init: function () {
            this._direction = [ 0.0, 1.0, 0.0 ];
            this._eye = [ 0.0, 25.0, 10.0 ];
            this._up = [ 0.0, 0.0, 1.0 ];
            this._radius = 1.0;
            this._forward = new OrbitManipulator.Interpolator( 1 );
            this._side = new OrbitManipulator.Interpolator( 1 );
            this._lookPosition = new OrbitManipulator.Interpolator( 2 );
            this._stepFactor = 1.0; // meaning radius*stepFactor to move
            this._target = [ 0.0, 0.0, 0.0 ];
            this._angleVertical = 0.0;
            this._angleHorizontal = 0.0;

            // tmp value use for computation
            this._tmpComputeRotation1 = Matrix.create();
            this._tmpComputeRotation2 = Matrix.create();
            this._tmpComputeRotation3 = Matrix.create();
            this._tmpGetTargetDir = [ 0.0, 0.0, 0.0 ];

            this._rotBase = Matrix.create();

            var self = this;

            this._controllerList = {};
            FirstPersonManipulator.ControllerList.forEach( function ( value ) {
                if ( FirstPersonManipulator[ value ] !== undefined ) {
                    self._controllerList[ value ] = new FirstPersonManipulator[ value ]( self );
                }
            } );

        },

        getEyePosition: function ( eye ) {
            eye[ 0 ] = this._eye[ 0 ];
            eye[ 1 ] = this._eye[ 1 ];
            eye[ 2 ] = this._eye[ 2 ];
            return eye;
        },

        setEyePosition: function ( eye ) {
            this._eye[ 0 ] = eye[ 0 ];
            this._eye[ 1 ] = eye[ 1 ];
            this._eye[ 2 ] = eye[ 2 ];
            return this;
        },

        getTarget: function ( pos, distance ) {
            if ( distance === undefined ) {
                distance = 25.0;
            }
            var dir = Vec3.mult( this._direction, distance, this._tmpGetTargetDir );
            Vec3.add( this._eye, dir, pos );
        },

        setTarget: function ( pos ) {
            this._target[ 0 ] = pos[ 0 ];
            this._target[ 1 ] = pos[ 1 ];
            this._target[ 2 ] = pos[ 2 ];
            var dir = this._tmpGetTargetDir;
            Vec3.sub( pos, this._eye, dir );
            dir[ 2 ] = 0.0;
            Vec3.normalize( dir, dir );
            this._angleHorizontal = Math.acos( dir[ 1 ] );
            if ( dir[ 0 ] < 0.0 ) {
                this._angleHorizontal = -this._angleHorizontal;
            }
            Vec3.sub( pos, this._eye, dir );
            Vec3.normalize( dir, dir );

            this._angleVertical = -Math.asin( dir[ 2 ] );
            Vec3.copy( dir, this._direction );
        },

        getLookPositionInterpolator: function () {
            return this._lookPosition;
        },
        getSideInterpolator: function () {
            return this._side;
        },
        getFowardInterpolator: function () {
            return this._forward;
        },

        computeRotation: ( function () {
            var upy = [ 0.0, 1.0, 0.0 ];
            var upz = [ 0.0, 0.0, 1.0 ];
            return function ( dx, dy ) {
                this._angleVertical += dy * 0.01;
                this._angleHorizontal -= dx * 0.01;

                var first = this._tmpComputeRotation1;
                var second = this._tmpComputeRotation2;
                var rotMat = this._tmpComputeRotation3;
                Matrix.makeRotate( this._angleVertical, 1.0, 0.0, 0.0, first );
                Matrix.makeRotate( this._angleHorizontal, 0.0, 0.0, 1.0, second );
                Matrix.mult( second, first, rotMat );

                var rotBase = this._rotBase;
                // TOTO refactor the way the rotation matrix is managed
                Matrix.preMult( rotMat, rotBase );

                this._direction = Matrix.transformVec3( rotMat, upy, this._direction );
                Vec3.normalize( this._direction, this._direction );

                Matrix.transformVec3( rotMat, upz, this._up );
            };
        } )(),
        reset: function () {
            this.init();
        },

        setStepFactor: function ( t ) {
            this._stepFactor = t;
        },

        update: ( function () {
            var vec = [ 0.0, 0.0 ];
            return function ( nv ) {
                var t = nv.getFrameStamp().getSimulationTime();
                if ( this._lastUpdate === undefined ) {
                    this._lastUpdate = t;
                }
                var dt = t - this._lastUpdate;
                this._lastUpdate = t;

                this._forward.update();
                this._side.update();
                var delta = this._lookPosition.update();

                this.computeRotation( -delta[ 0 ] * 0.5, -delta[ 1 ] * 0.5 );

                vec[ 0 ] = this._forward.getCurrent()[ 0 ];
                vec[ 1 ] = this._side.getCurrent()[ 0 ];
                if ( Vec2.length( vec ) > 1.0 ) {
                    Vec2.normalize( vec, vec );
                }
                var factor = this._radius;
                if ( this._radius < 1e-3 ) {
                    factor = 1.0;
                }
                this.moveForward( vec[ 0 ] * factor * this._stepFactor * dt );
                this.strafe( vec[ 1 ] * factor * this._stepFactor * dt );

                Vec3.add( this._eye, this._direction, this._target );

                Matrix.makeLookAt( this._eye, this._target, this._up, this._inverseMatrix );
            };
        } )(),
        setRotationBaseFromQuat: function ( quat ) {
            Matrix.makeRotateFromQuat( quat, this._rotBase );
        },

        getInverseMatrix: function () {
            return this._inverseMatrix;
        },

        moveForward: ( function () {
            var tmp = [ 0.0, 0.0, 0.0 ];
            return function ( distance ) {
                Vec3.normalize( this._direction, tmp );
                Vec3.mult( tmp, distance, tmp );
                Vec3.add( this._eye, tmp, this._eye );
            };
        } )(),

        strafe: ( function () {
            var tmp = [ 0.0, 0.0, 0.0 ];
            return function ( distance ) {
                Vec3.cross( this._direction, this._up, tmp );
                Vec3.normalize( tmp, tmp );
                Vec3.mult( tmp, distance, tmp );
                Vec3.add( this._eye, tmp, this._eye );
            };
        } )()
    } );

    ( function ( module ) {
        module.StandardMouseKeyboard = FirstPersonManipulatorMouseKeyboardController;
    } )( FirstPersonManipulator );

    ( function ( module ) {
        module.Oculus = FirstPersonManipulatorOculusController;
    } )( FirstPersonManipulator );

    return FirstPersonManipulator;
} );

define( 'osgGA/SwitchManipulator',[
    'osg/Notify'
], function ( Notify ) {

    /**
     *  OrbitManipulator
     *  @class
     */
    var SwitchManipulator = function () {
        this._manipulatorList = [];
        this._currentManipulator = undefined;
    };

    /** @lends SwitchManipulator.prototype */
    SwitchManipulator.prototype = {
        update: function ( nv ) {
            var manipulator = this.getCurrentManipulator();
            if ( manipulator !== undefined ) {
                return manipulator.update( nv );
            }
            return undefined;
        },
        setNode: function ( node ) {
            var manipulator = this.getCurrentManipulator();
            if ( manipulator.setNode === undefined ) {
                Notify.log( 'manipulator has not setNode method' );
                return;
            }
            manipulator.setNode( node );
        },
        getControllerList: function () {
            return this.getCurrentManipulator().getControllerList();
        },
        getNumManipulator: function () {
            return this._manipulatorList.length;
        },
        addManipulator: function ( manipulator ) {
            this._manipulatorList.push( manipulator );
            if ( this._currentManipulator === undefined ) {
                this.setManipulatorIndex( 0 );
            }
        },
        getManipulatorList: function () {
            return this._manipulatorList;
        },
        setManipulatorIndex: function ( index ) {
            this._currentManipulator = index;
        },
        getCurrentManipulatorIndex: function () {
            return this._currentManipulator;
        },
        getCurrentManipulator: function () {
            var manipulator = this._manipulatorList[ this._currentManipulator ];
            return manipulator;
        },
        reset: function () {
            this.getCurrentManipulator().reset();
        },
        computeHomePosition: function () {
            var manipulator = this.getCurrentManipulator();
            if ( manipulator !== undefined ) {
                manipulator.computeHomePosition();
            }
        },
        getInverseMatrix: function () {
            var manipulator = this.getCurrentManipulator();
            if ( manipulator !== undefined ) {
                return manipulator.getInverseMatrix();
            }
        }
    };

    return SwitchManipulator;
} );

define( 'osgGA/osgGA',[
    'Hammer',
    'osgGA/FirstPersonManipulator',
    'osgGA/FirstPersonManipulatorMouseKeyboardController',
    'osgGA/FirstPersonManipulatorOculusController',
    'osgGA/Manipulator',
    'osgGA/OrbitManipulator',
    'osgGA/OrbitManipulatorGamePadController',
    'osgGA/OrbitManipulatorHammerController',
    'osgGA/OrbitManipulatorLeapMotionController',
    'osgGA/OrbitManipulatorMouseKeyboardController',
    'osgGA/SwitchManipulator',
    'osgGA/OrbitManipulatorEnums'
], function ( Hammer, FirstPersonManipulator, FirstPersonManipulatorMouseKeyboardController, FirstPersonManipulatorOculusController, Manipulator, OrbitManipulator, OrbitManipulatorGamePadController, OrbitManipulatorHammerController, OrbitManipulatorLeapMotionController, OrbitManipulatorMouseKeyboardController, SwitchManipulator, OrbitManipulatorEnums ) {

    var osgGA = {};

    Hammer.NO_MOUSEEVENTS = true; // disable hammer js mouse events

    osgGA.FirstPersonManipulator = FirstPersonManipulator;
    osgGA.getFirstPersonStandardMouseKeyboardControllerClass = function () {
        return FirstPersonManipulatorMouseKeyboardController;
    };
    osgGA.getFirstPersonOculusControllerClass = function () {
        return FirstPersonManipulatorOculusController;
    };
    osgGA.Manipulator = Manipulator;
    osgGA.OrbitManipulator = OrbitManipulator;
    osgGA.getOrbitManipulatorGamePadController = function () {
        return OrbitManipulatorGamePadController;
    };
    osgGA.getOrbitManipulatorHammerController = function () {
        return OrbitManipulatorHammerController;
    };
    osgGA.getOrbitManipulatorLeapMotionController = function () {
        return OrbitManipulatorLeapMotionController;
    };
    osgGA.getOrbitManipulatorMouseKeyboardController = function () {
        return OrbitManipulatorMouseKeyboardController;
    };
    osgGA.SwitchManipulator = SwitchManipulator;

    osgGA.OrbitManipulator.Rotate = OrbitManipulatorEnums.ROTATE;
    osgGA.OrbitManipulator.Pan = OrbitManipulatorEnums.PAN;
    osgGA.OrbitManipulator.Zoom = OrbitManipulatorEnums.ZOOM;

    return osgGA;
} );

define( 'osgUtil/Composer',[
    'osg/Notify',
    'osg/Utils',
    'osg/Node',
    'osg/Depth',
    'osg/Texture',
    'osg/Camera',
    'osg/FrameBufferObject',
    'osg/Viewport',
    'osg/Matrix',
    'osg/Uniform',
    'osg/StateSet',
    'osg/Program',
    'osg/Shader',
    'osg/Shape',
    'osg/TransformEnums',
    'osg/Vec2',
    'osg/Vec3'
], function ( Notify, MACROUTILS, Node, Depth, Texture, Camera, FrameBufferObject, Viewport, Matrix,  Uniform, StateSet, Program, Shader, Shape, TransformEnums, Vec2, Vec3 ) {

    /*
     Composer is an helper to create post fx. The idea is to push one or more textures into a pipe of shader filter.

     how to use it:

     // example how to blur a texture and render it to screen
     var myTexture; // imagine it's your texture you want to process
     var composer = new Composer();
     composer.addPass(new Composer.Filter.InputTexture(myTexture));
     composer.addPass(new Composer.Filter.HBlur(5));
     composer.addPass(new Composer.Filter.VBlur(5));
     composer.renderToScreen(1200, 900);
     composer.build(); // if you dont build manually it will be done in the scenegraph while upading
     rootnode.addChild(composer);

     // now you can imagine to some process and use the result as input texture for a geometry
     var myTexture; // imagine it's your texture you want to process
     var myResultTexture = new Texture(); // imagine it's your texture you want to process
     myResultTexture.setTextureSize(1200,900);
     var composer = new Composer();
     composer.addPass(new Composer.Filter.InputTexture(myTexture));
     composer.addPass(new Composer.Filter.HBlur(5));
     composer.addPass(new Composer.Filter.VBlur(5), resultTexture);

     myGeometry.getStateSet().setTextureAttributeAndModes(0, resultTexture);
     rootnode.addChild(composer);

     */

    var Composer = function () {
        Node.call( this );
        this._stack = [];
        this._renderToScreen = false;
        this._dirty = false;
        var UpdateCallback = function () {

        };
        UpdateCallback.prototype = {
            update: function ( node /*, nv */ ) {
                if ( node.isDirty() ) {
                    node.build();
                }
            }
        };
        this.setUpdateCallback( new UpdateCallback() );
        this.getOrCreateStateSet().setAttributeAndModes( new Depth( 'DISABLE' ) );
    };

    Composer.prototype = MACROUTILS.objectInehrit( Node.prototype, {
        dirty: function () {
            for ( var i = 0, l = this._stack.length; i < l; i++ ) {
                this._stack[ i ].filter.dirty();
            }
        },

        // addPass support different signature
        // addPass(filter) -> the filter will be done on a texture of the same size than the previous pass
        // addPass(filter, textureWidth, textureHeight) -> the filter will be done on a texture width and height
        // addPass(filter, texture) -> the filter will be done on the giver texture using its width and height
        addPass: function ( filter, arg0, arg1 ) {
            if ( arg0 instanceof Texture ) {
                this._stack.push( {
                    filter: filter,
                    texture: arg0
                } );
            } else if ( arg0 !== undefined && arg1 !== undefined ) {
                this._stack.push( {
                    filter: filter,
                    width: Math.floor( arg0 ),
                    height: Math.floor( arg1 )
                } );
            } else {
                this._stack.push( {
                    filter: filter
                } );
            }
        },
        renderToScreen: function ( w, h ) {
            this._renderToScreen = true;
            this._renderToScreenWidth = w;
            this._renderToScreenHeight = h;
        },

        isDirty: function () {
            for ( var i = 0, l = this._stack.length; i < l; i++ ) {
                if ( this._stack[ i ].filter.isDirty() ) {
                    return true;
                }
            }
            return false;
        },

        build: function () {
            var root = this;
            this.removeChildren();
            var lastTextureResult;
            var self = this;
            this._stack.forEach( function ( element, i, array ) {
                if ( element.filter.isDirty() ) {
                    element.filter.build();
                }
                var stateSet = element.filter.getStateSet();
                var w, h;
                if ( element.texture !== undefined ) {
                    w = element.texture.getWidth();
                    h = element.texture.getHeight();
                } else if ( element.width !== undefined && element.height !== undefined ) {
                    w = element.width;
                    h = element.height;
                } else {
                    // get width from Texture0
                    var inputTexture = stateSet.getTextureAttribute( 0, 'Texture' );
                    if ( inputTexture === undefined ) {
                        Notify.warn( 'Composer can\'t find any information to setup texture output size' );
                    }
                    w = inputTexture.getWidth();
                    h = inputTexture.getHeight();
                }

                // is it the last filter and we want to render to screen ?
                var lastFilterRenderToScreen = ( i === array.length - 1 &&
                    self._renderToScreen === true );

                // check if we have something to do
                // else we will just translate stateset to the next filter
                // this part exist to manage the Composer.Filter.InputTexture that setup the first texture unit
                if ( !lastFilterRenderToScreen ) {
                    if ( stateSet.getAttribute( 'Program' ) === undefined ) {
                        array[ i + 1 ].filter.getStateSet().setTextureAttributeAndModes( 0, stateSet.getTextureAttribute( 0, 'Texture' ) );
                        return;
                    }
                }

                // check if we want to render on screen
                var camera = new Camera();
                camera.setClearMask( 0 );

                var texture;
                var quad;
                if ( lastFilterRenderToScreen === true ) {
                    w = self._renderToScreenWidth;
                    h = self._renderToScreenHeight;
                } else {
                    camera.setRenderOrder( Camera.PRE_RENDER, 0 );
                    texture = element.texture;
                    if ( texture === undefined ) {
                        texture = new Texture();
                        texture.setTextureSize( w, h );
                    }
                    camera.attachTexture( FrameBufferObject.COLOR_ATTACHMENT0, texture, 0 );
                }

                var vp = new Viewport( 0, 0, w, h );
                camera.setReferenceFrame( TransformEnums.ABSOLUTE_RF );
                camera.setViewport( vp );
                Matrix.makeOrtho( -w / 2, w / 2, -h / 2, h / 2, -5, 5, camera.getProjectionMatrix() );
                camera.setStateSet( element.filter.getStateSet() );

                quad = Shape.createTexturedQuadGeometry( -w / 2, -h / 2, 0,
                    w, 0, 0,
                    0, h, 0 );

                if ( element.filter.buildGeometry !== undefined )
                    quad = element.filter.buildGeometry( quad );

                quad.setName( 'composer layer' );

                lastTextureResult = texture;

                // assign the result texture to the next stateset
                if ( i + 1 < array.length ) {
                    array[ i + 1 ].filter.getStateSet().setTextureAttributeAndModes( 0, lastTextureResult );
                }

                camera.addChild( quad );
                element.filter.getStateSet().addUniform( Uniform.createFloat2( [ w, h ], 'RenderSize' ) );
                camera.setName( 'Composer Pass' + i );
                root.addChild( camera );
            } );
            this._resultTexture = lastTextureResult;
        }
    } );

    Composer.Filter = function () {
        this._stateSet = new StateSet();
        this._dirty = true;
    };

    Composer.Filter.prototype = {
        getStateSet: function () {
            return this._stateSet;
        },
        getOrCreateStateSet: function () {
            return this._stateSet;
        },
        dirty: function () {
            this._dirty = true;
        },
        isDirty: function () {
            return this._dirty;
        }
    };


    Composer.Filter.defaultVertexShader = [
        '#ifdef GL_ES',
        'precision highp float;',
        '#endif',
        'attribute vec3 Vertex;',
        'attribute vec2 TexCoord0;',
        'varying vec2 FragTexCoord0;',
        'uniform mat4 ModelViewMatrix;',
        'uniform mat4 ProjectionMatrix;',
        'void main(void) {',
        '  gl_Position = ProjectionMatrix * ModelViewMatrix * vec4(Vertex,1.0);',
        '  FragTexCoord0 = TexCoord0;',
        '}',
        ''
    ].join( '\n' );

    Composer.Filter.defaultFragmentShaderHeader = [
        '#ifdef GL_ES',
        'precision highp float;',
        '#endif',
        'varying vec2 FragTexCoord0;',
        'uniform vec2 RenderSize;',
        'uniform sampler2D Texture0;',
        ''
    ].join( '\n' );

    Composer.Filter.shaderUtils = [
        'vec4 packFloatTo4x8(in float v) {',
        'vec4 enc = vec4(1.0, 255.0, 65025.0, 160581375.0) * v;',
        'enc = fract(enc);',
        'enc -= enc.yzww * vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);',
        'return enc;',
        '}',

        ' ',
        'vec4 pack2FloatTo4x8(in vec2 val) {',
        ' const vec2 bitSh = vec2(256.0, 1.0);',
        ' const vec2 bitMsk = vec2(0.0, 1.0/256.0);',
        ' vec2 res1 = fract(val.x * bitSh);',
        ' res1 -= res1.xx * bitMsk;',
        ' vec2 res2 = fract(val.y * bitSh);',
        ' res2 -= res2.xx * bitMsk;',
        ' return vec4(res1.x,res1.y,res2.x,res2.y);',
        '}',
        ' ',
        'float unpack4x8ToFloat( vec4 rgba ) {',
        ' return dot( rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/160581375.0) );',
        '}',
        ' ',
        'vec2 unpack4x8To2Float(in vec4 val) {',
        ' const vec2 unshift = vec2(1.0/256.0, 1.0);',
        ' return vec2(dot(val.xy, unshift), dot(val.zw, unshift));',
        '}',

        'vec2 encodeNormal (vec3 n)',
        '{',
        '    float f = sqrt(8.0*n.z+8.0);',
        '    return n.xy / f + 0.5;',
        '}',

        'vec3 decodeNormal (vec2 enc)',
        '{',
        '    vec2 fenc = enc*4.0-2.0;',
        '    float f = dot(fenc,fenc);',
        '    float g = sqrt(1.0-f/4.0);',
        '    vec3 n;',
        '    n.xy = fenc*g;',
        '    n.z = 1.0-f/2.0;',
        '    return n;',
        '}',
        ''
    ].join( '\n' );

    Composer.Filter.Helper = {
        getOrCreatePascalCoefficients: function () {
            var cache = Composer.Filter.Helper.getOrCreatePascalCoefficients.cache;
            if ( cache !== undefined ) {
                return cache;
            }

            cache = ( function ( kernelSize ) {
                var pascalTriangle = [
                    [ 1 ]
                ];
                for ( var j = 0; j < ( kernelSize - 1 ); j++ ) {
                    //var sum = Math.pow( 2, j );
                    var currentRow = pascalTriangle[ j ];
                    var currentRowSize = currentRow.length;

                    var nextRowSize = currentRowSize + 1;
                    var nextRow = new Array( currentRowSize );
                    nextRow[ 0 ] = 1.0;
                    nextRow[ nextRowSize - 1 ] = 1.0;

                    var idx = 1;
                    for ( var p = 0; p < currentRowSize - 1; p++ ) {
                        var val = ( currentRow[ p ] + currentRow[ p + 1 ] );
                        nextRow[ idx++ ] = val;
                    }
                    pascalTriangle.push( nextRow );
                }

                // compute real coef dividing by sum
                ( function () {
                    for ( var a = 0; a < pascalTriangle.length; a++ ) {
                        var row = pascalTriangle[ a ];
                        //var str = '';

                        var sum = Math.pow( 2, a );
                        for ( var i = 0; i < row.length; i++ ) {
                            row[ i ] = row[ i ] / sum;
                            //str += row[i].toString() + ' ';
                        }
                        //Notify.log(str);
                    }
                } )();

                return pascalTriangle;
            } )( 20 );
            Composer.Filter.Helper.getOrCreatePascalCoefficients.cache = cache;
            return cache;
        }
    };

    Composer.Filter.Custom = function ( fragmentShader, uniforms ) {
        Composer.Filter.call( this );
        this._fragmentShader = fragmentShader;
        this._uniforms = uniforms;
        this._vertexShader = Composer.Filter.defaultVertexShader;
    };

    Composer.Filter.Custom.prototype = MACROUTILS.objectInehrit( Composer.Filter.prototype, {
        build: function () {

            var program = new Program(
                new Shader( 'VERTEX_SHADER', this._vertexShader ),
                new Shader( 'FRAGMENT_SHADER', this._fragmentShader ) );

            if ( this._uniforms ) {
                var unitIndex = 0;

                var r = this._fragmentShader.match( /uniform\s+\w+\s+\w+/g );
                if ( r !== null ) {
                    for ( var i = 0, l = r.length; i < l; i++ ) {
                        var match = r[ i ].match( /uniform\s+(\w+)\s+(\w+)/ );
                        var uniformType = match[ 1 ];
                        var uniformName = match[ 2 ];
                        var uniform;

                        if ( this._uniforms[ uniformName ] !== undefined ) {
                            var uniformValue = this._uniforms[ uniformName ];
                            if ( uniformType.search( 'sampler' ) !== -1 ) {
                                this._stateSet.setTextureAttributeAndModes( unitIndex, uniformValue );
                                uniform = Uniform.createInt1( unitIndex, uniformName );
                                unitIndex++;
                                this._stateSet.addUniform( uniform );
                            } else {
                                if ( Uniform.isUniform( uniformValue ) ) {
                                    uniform = uniformValue;
                                } else {
                                    uniform = Uniform[ uniformType ]( this._uniforms[ uniformName ], uniformName );
                                }
                                this._stateSet.addUniform( uniform );
                            }
                        }
                    }
                }
            }
            this._stateSet.setAttributeAndModes( program );
            this._dirty = false;
        }
    } );



    Composer.Filter.AverageHBlur = function ( nbSamplesOpt ) {
        Composer.Filter.call( this );
        if ( nbSamplesOpt === undefined ) {
            this.setBlurSize( 5 );
        } else {
            this.setBlurSize( nbSamplesOpt );
        }
        this._pixelSize = 1.0;
    };

    Composer.Filter.AverageHBlur.prototype = MACROUTILS.objectInehrit( Composer.Filter.prototype, {
        setBlurSize: function ( nbSamples ) {
            if ( nbSamples % 2 !== 1 ) {
                nbSamples += 1;
            }
            this._nbSamples = nbSamples;
            this.dirty();
        },
        setPixelSize: function ( value ) {
            this._pixelSize = value;
            this.dirty();
        },
        getUVOffset: function ( value ) {
            return 'vec2(float(' + value + '), 0.0)/RenderSize[0];';
        },
        getShaderBlurKernel: function () {
            var nbSamples = this._nbSamples;
            var kernel = [];
            kernel.push( ' pixel = texture2D(Texture0, FragTexCoord0 );' );
            kernel.push( ' if (pixel.w == 0.0) { gl_FragColor = pixel; return; }' );
            kernel.push( ' vec2 offset;' );
            for ( var i = 1; i < Math.ceil( nbSamples / 2 ); i++ ) {
                kernel.push( ' offset = ' + this.getUVOffset( i * this._pixelSize ) );
                kernel.push( ' pixel += texture2D(Texture0, FragTexCoord0 + offset);' );
                kernel.push( ' pixel += texture2D(Texture0, FragTexCoord0 - offset);' );
            }
            kernel.push( ' pixel /= float(' + nbSamples + ');' );
            return kernel;
        },
        build: function () {
            //var nbSamples = this._nbSamples;
            var vtx = Composer.Filter.defaultVertexShader;
            var fgt = [
                Composer.Filter.defaultFragmentShaderHeader,
                'uniform float width;',

                'void main (void)',
                '{',
                '  vec4 pixel;',
                this.getShaderBlurKernel().join( '\n' ),
                '  gl_FragColor = vec4(pixel);',
                '}',
                ''
            ].join( '\n' );

            var program = new Program(
                new Shader( 'VERTEX_SHADER', vtx ),
                new Shader( 'FRAGMENT_SHADER', fgt ) );

            if ( this._stateSet.getUniform( 'Texture0' ) === undefined ) {
                this._stateSet.addUniform( Uniform.createInt1( 0, 'Texture0' ) );
            }
            this._stateSet.setAttributeAndModes( program );
            this._dirty = false;
        }
    } );


    Composer.Filter.AverageVBlur = function ( nbSamplesOpt ) {
        Composer.Filter.AverageHBlur.call( this, nbSamplesOpt );
    };
    Composer.Filter.AverageVBlur.prototype = MACROUTILS.objectInehrit( Composer.Filter.AverageHBlur.prototype, {
        getUVOffset: function ( value ) {
            return 'vec2(0.0, float(' + value + '))/RenderSize[1];';
        }
    } );

    Composer.Filter.BilateralHBlur = function ( options ) {
        Composer.Filter.call( this );

        if ( options === undefined ) {
            options = {};
        }

        var nbSamplesOpt = options.nbSamples;
        var depthTexture = options.depthTexture;
        var radius = options.radius;

        if ( nbSamplesOpt === undefined ) {
            this.setBlurSize( 5 );
        } else {
            this.setBlurSize( nbSamplesOpt );
        }
        this._depthTexture = depthTexture;
        this._radius = Uniform.createFloat( 1.0, 'radius' );
        this._pixelSize = Uniform.createFloat( 1.0, 'pixelSize' );
        this.setRadius( radius );
    };

    Composer.Filter.BilateralHBlur.prototype = MACROUTILS.objectInehrit( Composer.Filter.prototype, {
        setBlurSize: function ( nbSamples ) {
            if ( nbSamples % 2 !== 1 ) {
                nbSamples += 1;
            }
            //Notify.log('BlurSize ' + nbSamples);
            this._nbSamples = nbSamples;
            this.dirty();
        },
        setPixelSize: function ( value ) {
            this._pixelSize.get()[ 0 ] = value;
            this._pixelSize.dirty();
        },
        setRadius: function ( radius ) {
            this._radius.get()[ 0 ] = radius; // *2.0;
            this._radius.dirty();
        },
        getUVOffset: function ( value ) {
            return 'vec2(0.0, float(' + value + ') * pixelSize )/RenderSize[1];';
        },
        getShaderBlurKernel: function () {
            var nbSamples = this._nbSamples;
            var kernel = [];
            kernel.push( ' pixel = texture2D(Texture0, FragTexCoord0 );' );
            kernel.push( ' if (pixel.w <= 0.0001) { gl_FragColor = vec4(1.0); return; }' );
            kernel.push( ' vec2 offset, tmpUV;' );
            kernel.push( ' depth = getDepthValue(texture2D(Texture1, FragTexCoord0 ));' );
            for ( var i = 1; i < Math.ceil( nbSamples / 2 ); i++ ) {
                kernel.push( ' offset = ' + this.getUVOffset( i ) );

                kernel.push( ' tmpUV =  FragTexCoord0 + offset;' );
                kernel.push( ' tmpDepth = getDepthValue(texture2D(Texture1, tmpUV ));' );
                kernel.push( ' if ( abs(depth-tmpDepth) < radius) {' );
                kernel.push( '   pixel += texture2D(Texture0, tmpUV);' );
                kernel.push( '   nbHits += 1.0;' );
                kernel.push( ' }' );

                kernel.push( ' tmpUV =  FragTexCoord0 - offset;' );
                kernel.push( ' tmpDepth = getDepthValue(texture2D(Texture1, tmpUV ));' );
                kernel.push( ' if ( abs(depth-tmpDepth) < radius) {' );
                kernel.push( '   pixel += texture2D(Texture0, tmpUV);' );
                kernel.push( '   nbHits += 1.0;' );
                kernel.push( ' }' );
            }
            kernel.push( ' pixel /= nbHits;' );
            return kernel;
        },
        build: function () {
            //var nbSamples = this._nbSamples;
            var vtx = Composer.Filter.defaultVertexShader;
            var fgt = [
                Composer.Filter.defaultFragmentShaderHeader,
                'uniform sampler2D Texture1;',
                'uniform float width;',
                'uniform mat4 projection;',
                'uniform float radius;',
                'uniform float pixelSize;',

                'float znear,zfar,zrange;',
                '',
                Composer.Filter.shaderUtils,
                '',
                'float getDepthValue(vec4 v) {',
                '  float depth = unpack4x8ToFloat(v);',
                '  depth = depth*zrange+znear;',
                '  return -depth;',
                '}',

                'void main (void)',
                '{',
                '  vec4 pixel;',
                '  float depth, tmpDepth;',
                '  znear = projection[3][2] / (projection[2][2]-1.0);',
                '  zfar = projection[3][2] / (projection[2][2]+1.0);',
                '  zrange = zfar-znear;',
                '  float nbHits = 1.0;',

                this.getShaderBlurKernel().join( '\n' ),
                '  gl_FragColor = vec4(pixel);',
                '}',
                ''
            ].join( '\n' );

            var program = new Program(
                new Shader( 'VERTEX_SHADER', vtx ),
                new Shader( 'FRAGMENT_SHADER', fgt ) );

            if ( this._stateSet.getUniform( 'Texture0' ) === undefined ) {
                this._stateSet.addUniform( Uniform.createInt1( 0, 'Texture0' ) );
            }
            if ( this._stateSet.getUniform( 'Texture1' ) === undefined ) {
                this._stateSet.addUniform( Uniform.createInt1( 1, 'Texture1' ) );
            }
            this._stateSet.addUniform( this._radius );
            this._stateSet.addUniform( this._pixelSize );
            this._stateSet.setTextureAttributeAndModes( 1, this._depthTexture );
            this._stateSet.setAttributeAndModes( program );
            this._dirty = false;
        }
    } );

    Composer.Filter.BilateralVBlur = function ( options ) {
        Composer.Filter.BilateralHBlur.call( this, options );
    };

    Composer.Filter.BilateralVBlur.prototype = MACROUTILS.objectInehrit( Composer.Filter.BilateralHBlur.prototype, {
        getUVOffset: function ( value ) {
            return 'vec2(float(' + value + ')*pixelSize,0.0)/RenderSize[0];';
        }
    } );

    // InputTexture is a fake filter to setup the first texture
    // in the composer pipeline
    Composer.Filter.InputTexture = function ( texture ) {
        Composer.Filter.call( this );
        this._stateSet.setTextureAttributeAndModes( 0, texture );
    };
    Composer.Filter.InputTexture.prototype = MACROUTILS.objectInehrit( Composer.Filter.prototype, {
        build: function () {
            this._dirty = false;
        }
    } );

    // Operate a Gaussian horizontal blur
    Composer.Filter.HBlur = function ( nbSamplesOpt ) {
        Composer.Filter.call( this );
        if ( nbSamplesOpt === undefined ) {
            this.setBlurSize( 5 );
        } else {
            this.setBlurSize( nbSamplesOpt );
        }
    };

    Composer.Filter.HBlur.prototype = MACROUTILS.objectInehrit( Composer.Filter.prototype, {
        setBlurSize: function ( nbSamples ) {
            if ( nbSamples % 2 !== 1 ) {
                nbSamples += 1;
            }
            this._nbSamples = nbSamples;
            this.dirty();
        },
        getUVOffset: function ( value ) {
            return 'vec2(float(' + value + '), 0.0)/RenderSize[0];';
        },
        build: function () {
            var nbSamples = this._nbSamples;
            var vtx = Composer.Filter.defaultVertexShader;
            var pascal = Composer.Filter.Helper.getOrCreatePascalCoefficients();
            var weights = pascal[ nbSamples - 1 ];
            var start = Math.floor( nbSamples / 2.0 );
            var kernel = [];
            kernel.push( ' pixel += float(' + weights[ start ] + ')*texture2D(Texture0, FragTexCoord0 ).rgb;' );
            var offset = 1;
            kernel.push( ' vec2 offset;' );
            for ( var i = start + 1; i < nbSamples; i++ ) {
                var weight = weights[ i ];
                kernel.push( ' offset = ' + this.getUVOffset( i ) );
                offset++;
                kernel.push( ' pixel += ' + weight + '*texture2D(Texture0, FragTexCoord0 + offset).rgb;' );
                kernel.push( ' pixel += ' + weight + '*texture2D(Texture0, FragTexCoord0 - offset).rgb;' );
            }

            var fgt = [
                Composer.Filter.defaultFragmentShaderHeader,
                'uniform float width;',

                'void main (void)',
                '{',
                '  vec3 pixel;',
                kernel.join( '\n' ),
                '  gl_FragColor = vec4(pixel,1.0);',
                '}',
                ''
            ].join( '\n' );

            var program = new Program(
                new Shader( 'VERTEX_SHADER', vtx ),
                new Shader( 'FRAGMENT_SHADER', fgt ) );

            if ( this._stateSet.getUniform( 'Texture0' ) === undefined ) {
                this._stateSet.addUniform( Uniform.createInt1( 0, 'Texture0' ) );
            }
            this._stateSet.setAttributeAndModes( program );
            this._dirty = false;
        }
    } );

    // Operate a Gaussian vertical blur
    Composer.Filter.VBlur = function ( /*nbSamplesOpt*/ ) {
        Composer.Filter.HBlur.call( this );
    };

    Composer.Filter.VBlur.prototype = MACROUTILS.objectInehrit( Composer.Filter.HBlur.prototype, {
        getUVOffset: function ( value ) {
            return 'vec2(0.0, float(' + value + '))/RenderSize[1];';
        }
    } );

    // Sobel filter
    // http://en.wikipedia.org/wiki/Sobel_operator
    Composer.Filter.SobelFilter = function () {
        Composer.Filter.call( this );
        this._color = Uniform.createFloat3( [ 1.0, 1.0, 1.0 ], 'color' );
        this._factor = Uniform.createFloat( 1.0, 'factor' );
    };

    Composer.Filter.SobelFilter.prototype = MACROUTILS.objectInehrit( Composer.Filter.prototype, {
        setColor: function ( color ) {
            this._color.get()[ 0 ] = color[ 0 ];
            this._color.get()[ 1 ] = color[ 1 ];
            this._color.get()[ 2 ] = color[ 2 ];
            this._color.dirty();
        },
        setFactor: function ( f ) {
            this._factor.get()[ 0 ] = f;
            this._factor.dirty();
        },
        build: function () {
            var stateSet = this._stateSet;
            var vtx = Composer.Filter.defaultVertexShader;
            var fgt = [
                '',
                Composer.Filter.defaultFragmentShaderHeader,
                'uniform vec3 color;',
                'uniform float factor;',
                'void main (void)',
                '{',
                '  float fac0 = 2.0;',
                '  float fac1 = 1.0;',
                '  float offsetx = 1.0/RenderSize[0];',
                '  float offsety = 1.0/RenderSize[1];',
                '  vec4 texel0 = texture2D(Texture0, FragTexCoord0 + vec2(offsetx, offsety));',
                '  vec4 texel1 = texture2D(Texture0, FragTexCoord0 + vec2(offsetx, 0.0));',
                '  vec4 texel2 = texture2D(Texture0, FragTexCoord0 + vec2(offsetx, -offsety));',
                '  vec4 texel3 = texture2D(Texture0, FragTexCoord0 + vec2(0.0, -offsety));',
                '  vec4 texel4 = texture2D(Texture0, FragTexCoord0 + vec2(-offsetx, -offsety));',
                '  vec4 texel5 = texture2D(Texture0, FragTexCoord0 + vec2(-offsetx, 0.0));',
                '  vec4 texel6 = texture2D(Texture0, FragTexCoord0 + vec2(-offsetx, offsety));',
                '  vec4 texel7 = texture2D(Texture0, FragTexCoord0 + vec2(0.0, offsety));',
                '  vec4 rowx = -fac0*texel5 + fac0*texel1 +  -fac1*texel6 + fac1*texel0 + -fac1*texel4 + fac1*texel2;',
                '  vec4 rowy = -fac0*texel3 + fac0*texel7 +  -fac1*texel4 + fac1*texel6 + -fac1*texel2 + fac1*texel0;',
                '  float mag = sqrt(dot(rowy,rowy)+dot(rowx,rowx));',
                '  if (mag < 1.0/255.0) { discard; return; }',
                '  mag *= factor;',
                '  mag = min(1.0, mag);',
                '  gl_FragColor = vec4(color*mag,mag);',
                '}',
                ''
            ].join( '\n' );

            var program = new Program(
                new Shader( 'VERTEX_SHADER', vtx ),
                new Shader( 'FRAGMENT_SHADER', fgt ) );

            stateSet.setAttributeAndModes( program );
            stateSet.addUniform( this._color );
            stateSet.addUniform( this._factor );
            stateSet.addUniform( Uniform.createInt1( 0, 'Texture0' ) );
            this._dirty = false;
        }
    } );



    Composer.Filter.BlendMix = function () {
        Composer.Filter.call( this );
        var texture0, texture1, mixValue;
        var unit0 = 0;
        var unit1 = 1;
        var stateSet = this._stateSet;
        if ( arguments.length === 3 ) {
            texture0 = arguments[ 0 ];
            texture1 = arguments[ 1 ];
            mixValue = arguments[ 2 ];
            unit0 = 1;
            unit1 = 2;
            stateSet.setTextureAttributeAndModes( unit0, texture0 );
        } else if ( arguments.length === 2 ) {
            texture1 = arguments[ 0 ];
            mixValue = arguments[ 1 ];
        } else if ( arguments.length === 1 ) {
            texture1 = arguments[ 0 ];
            mixValue = 0.5;
        }
        stateSet.setTextureAttributeAndModes( unit1, texture1 );
        stateSet.addUniform( Uniform.createInt1( unit0, 'Texture0' ) );
        stateSet.addUniform( Uniform.createInt1( unit1, 'Texture1' ) );
        this._mixValueUniform = Uniform.createFloat1( mixValue, 'MixValue' );
        stateSet.addUniform( this._mixValueUniform );
    };

    Composer.Filter.BlendMix = MACROUTILS.objectInehrit( Composer.Filter.prototype, {
        getBlendFactorUniform: function () {
            return this._mixValueUniform;
        },

        build: function () {
            var stateSet = this._stateSet;
            var vtx = Composer.Filter.defaultVertexShader;
            var fgt = [
                '',
                Composer.Filter.defaultFragmentShaderHeader,
                'uniform sampler2D Texture1;',
                'uniform float MixValue;',

                'void main (void)',
                '{',
                '  gl_FragColor = mix(texture2D(Texture0,FragTexCoord0), texture2D(Texture1,FragTexCoord0),MixValue);',
                '}',
                ''
            ].join( '\n' );

            var program = new Program(
                new Shader( 'VERTEX_SHADER', vtx ),
                new Shader( 'FRAGMENT_SHADER', fgt ) );

            stateSet.setAttributeAndModes( program );
            this._dirty = false;
        }
    } );


    Composer.Filter.BlendMultiply = function () {
        Composer.Filter.call( this );
        var stateSet = this._stateSet;
        var texture0, texture1;
        var unit0 = 0;
        var unit1 = 1;
        if ( arguments.length === 2 ) {
            texture0 = arguments[ 0 ];
            texture1 = arguments[ 1 ];
            unit0 = 1;
            unit0 = 2;
            stateSet.setTextureAttributeAndModes( unit0, texture0 );
        } else if ( arguments.length === 1 ) {
            texture1 = arguments[ 0 ];
        }
        stateSet.setTextureAttributeAndModes( unit1, texture1 );
        stateSet.addUniform( Uniform.createInt1( unit0, 'Texture0' ) );
        stateSet.addUniform( Uniform.createInt1( unit1, 'Texture1' ) );
    };

    Composer.Filter.BlendMultiply.prototype = MACROUTILS.objectInehrit( Composer.Filter.prototype, {
        build: function () {
            var vtx = Composer.Filter.defaultVertexShader;
            var fgt = [
                '',
                Composer.Filter.defaultFragmentShaderHeader,
                'uniform sampler2D Texture1;',
                'uniform float MixValue;',

                'void main (void)',
                '{',
                '  gl_FragColor = texture2D(Texture0,FragTexCoord0)*texture2D(Texture1,FragTexCoord0);',
                '}',
                ''
            ].join( '\n' );

            var program = new Program(
                new Shader( 'VERTEX_SHADER', vtx ),
                new Shader( 'FRAGMENT_SHADER', fgt ) );

            this._stateSet.setAttributeAndModes( program );
            this._dirty = false;
        }
    } );

    Composer.Filter.SSAO = function ( options ) {
        Composer.Filter.call( this );

        var stateSet = this._stateSet;
        var nbSamples = 16;
        var radius = 0.05;
        if ( options !== undefined ) {
            if ( options.nbSamples !== undefined )
                nbSamples = options.nbSamples;

            if ( options.radius !== undefined )
                radius = options.radius;
        }

        var textureNormal = options.normal;
        var texturePosition = options.position;
        this._radius = radius;
        this._nbSamples = nbSamples;
        this._noiseTextureSize = 16;
        this._sceneRadius = 2.0;

        stateSet.addUniform( Uniform.createFloat1( 1.0, 'Power' ) );
        stateSet.addUniform( Uniform.createFloat1( radius, 'Radius' ) );
        stateSet.addUniform( Uniform.createInt1( 0, 'Texture0' ) );
        stateSet.addUniform( Uniform.createInt1( 1, 'Texture1' ) );
        stateSet.addUniform( Uniform.createInt1( 2, 'Texture2' ) );
        stateSet.addUniform( Uniform.createFloat1( 0.1, 'AngleLimit' ) );

        var w = textureNormal.getWidth();
        var h = textureNormal.getHeight();
        this._size = [ w, h ];

        stateSet.setTextureAttributeAndModes( 0, textureNormal );
        stateSet.setTextureAttributeAndModes( 1, texturePosition );

        this.initNoise();

    };

    Composer.Filter.SSAO.prototype = MACROUTILS.objectInehrit( Composer.Filter.prototype, {

        initNoise: function () {
            var sizeNoise = this._noiseTextureSize;
            var noise = new Array( sizeNoise * sizeNoise * 3 );
            ( function ( array ) {
                var n = [ 0.0, 0.0 ];
                for ( var i = 0; i < sizeNoise * sizeNoise; i++ ) {
                    n[ 0 ] = 2.0 * ( Math.random() - 0.5 );
                    n[ 1 ] = 2.0 * ( Math.random() - 0.5 );

                    Vec2.normalize( n, n );
                    array[ i * 3 + 0 ] = 255 * ( n[ 0 ] * 0.5 + 0.5 );
                    array[ i * 3 + 1 ] = 255 * ( n[ 1 ] * 0.5 + 0.5 );
                    array[ i * 3 + 2 ] = 255 * 0.5;
                }
            } )( noise );

            var noiseTexture = new Texture();
            noiseTexture.setWrapS( 'REPEAT' );
            noiseTexture.setWrapT( 'REPEAT' );
            noiseTexture.setMinFilter( 'NEAREST' );
            noiseTexture.setMagFilter( 'NEAREST' );

            noiseTexture.setTextureSize( sizeNoise, sizeNoise );
            noiseTexture.setImage( new Uint8Array( noise ), 'RGB' );
            this._noiseTexture = noiseTexture;
        },
        setSceneRadius: function ( value ) {
            this._sceneRadius = value;
            this.dirty();
        },
        setAngleLimit: function ( value ) {
            var uniform = this._stateSet.getUniform( 'AngleLimit' );
            uniform.get()[ 0 ] = value;
            uniform.dirty();
        },
        setNbSamples: function ( value ) {
            if ( value === this._nbSamples ) {
                return;
            }
            this._nbSamples = Math.floor( value );
            this.dirty();
        },
        setRadius: function ( value ) {
            var uniform = this._stateSet.getUniform( 'Radius' );
            uniform.get()[ 0 ] = value;
            uniform.dirty();
        },
        setPower: function ( value ) {
            var uniform = this._stateSet.getUniform( 'Power' );
            uniform.get()[ 0 ] = value;
            uniform.dirty();
        },
        build: function () {
            var stateSet = this._stateSet;
            var nbSamples = this._nbSamples;
            var kernel = new Array( nbSamples * 4 );
            ( function ( array ) {
                var v = [ 0.0, 0.0, 0.0 ];
                for ( var i = 0; i < nbSamples; i++ ) {
                    v[ 0 ] = 2.0 * ( Math.random() - 0.5 );
                    v[ 1 ] = 2.0 * ( Math.random() - 0.5 );
                    v[ 2 ] = Math.random();

                    Vec3.normalize( v, v );
                    var scale = Math.max( i / nbSamples, 0.1 );
                    scale = 0.1 + ( 1.0 - 0.1 ) * ( scale * scale );
                    array[ i * 3 + 0 ] = v[ 0 ];
                    array[ i * 3 + 1 ] = v[ 1 ];
                    array[ i * 3 + 2 ] = v[ 2 ];
                    array[ i * 3 + 3 ] = scale;
                }
            } )( kernel );


            stateSet.setTextureAttributeAndModes( 2, this._noiseTexture );
            var uniform = stateSet.getUniform( 'noiseSampling' );
            if ( uniform === undefined ) {
                uniform = Uniform.createFloat2( [ this._size[ 0 ] / this._noiseTextureSize, this._size[ 1 ] / this._noiseTextureSize ], 'noiseSampling' );
                stateSet.addUniform( uniform );
            } else {
                uniform.set( [ this._size[ 0 ] / this._noiseTextureSize, this._size[ 1 ] / this._noiseTextureSize ] );
                uniform.dirty();
            }
            var vertexshader = [
                '',
                '#ifdef GL_ES',
                'precision highp float;',
                '#endif',
                'attribute vec3 Vertex;',
                'attribute vec2 TexCoord0;',
                'varying vec2 FragTexCoord0;',
                'uniform mat4 ModelViewMatrix;',
                'uniform mat4 ProjectionMatrix;',
                'void main(void) {',
                '  gl_Position = ProjectionMatrix * ModelViewMatrix * vec4(Vertex,1.0);',
                '  FragTexCoord0 = TexCoord0;',
                '}',
                ''
            ].join( '\n' );

            var kernelglsl = [];
            for ( var i = 0; i < nbSamples; i++ ) {
                kernelglsl.push( 'kernel[' + i + '] = vec4(' + kernel[ i * 3 ] + ',' + kernel[ i * 3 + 1 ] + ', ' + kernel[ i * 3 + 2 ] + ', ' + kernel[ i * 3 + 3 ] + ');' );
            }
            kernelglsl = kernelglsl.join( '\n' );

            //var ssaoRadiusMin = this._sceneRadius * 0.002;
            //var ssaoRadiusMax = this._sceneRadius * 0.05;
            //var ssaoRadiusStep = ( ssaoRadiusMax - ssaoRadiusMin ) / 200.0;

            var fragmentshader = [
                '',
                Composer.Filter.defaultFragmentShaderHeader,
                'uniform sampler2D Texture1;',
                'uniform sampler2D Texture2;',
                'uniform mat4 projection;',
                'uniform vec2 noiseSampling;',
                'uniform float Power;', //'+ '{ 'min': 0.1, 'max': 16.0, 'step': 0.1, 'value': 1.0 }',
                'uniform float Radius;', //'+ '{ 'min': ' + ssaoRadiusMin +', 'max': ' + ssaoRadiusMax + ', 'step': '+ ssaoRadiusStep + ', 'value': 0.01 }',
                'uniform float AngleLimit;',
                '#define NB_SAMPLES ' + this._nbSamples,
                'float depth;',
                'vec3 normal;',
                'vec4 position;',
                'vec4 kernel[' + nbSamples + '];',


                'mat3 computeBasis()',
                '{',
                '  vec2 uvrand = FragTexCoord0*noiseSampling;',
                '  vec3 rvec = texture2D(Texture2, uvrand*2.0).xyz*2.0-vec3(1.0);',
                '  vec3 tangent = normalize(rvec - normal * dot(rvec, normal));',
                '  vec3 bitangent = cross(normal, tangent);',
                '  mat3 tbn = mat3(tangent, bitangent, normal);',
                '  return tbn;',
                '}',

                'void main (void)',
                '{',
                kernelglsl,
                '  position = texture2D(Texture1, FragTexCoord0);',
                '  vec4 p = texture2D(Texture0, FragTexCoord0);',
                '  depth = p.w;',
                '  normal = vec3(p);',
                '  if ( position.w == 0.0) {',
                '     gl_FragColor = vec4(1.0,1.0,1.0,0.0);',
                '     return;',
                '  }',
                '',
                ' mat3 tbn = computeBasis();',
                ' float occlusion = 0.0;',
                ' for (int i = 0; i < NB_SAMPLES; i++) {',
                '    vec3 vecKernel = vec3(kernel[i]);',
                '    vecKernel[2] = max(AngleLimit,vecKernel[2]);',
                '    vec3 sample = tbn * vecKernel;',
                '    vec3 dir = sample;',
                '    float w = dot(dir, normal);',
                '    float dist = 1.0-kernel[i].w;',
                '    w *= dist*dist*Power;',
                '    sample = dir * float(Radius) + position.xyz;',

                '    vec4 offset = projection * vec4(sample,1.0);',
                '    offset.xy /= offset.w;',
                '    offset.xy = offset.xy * 0.5 + 0.5;',

                '    float sample_depth = texture2D(Texture1, offset.xy).z;',
                '    float range_check = abs(sample.z - sample_depth) < float(Radius) ? 1.0 : 0.0;',
                '    occlusion += (sample_depth > sample.z ? 1.0 : 0.0) * range_check*w;',

                ' }',
                ' occlusion = 1.0 - (occlusion / float(NB_SAMPLES));',
                ' gl_FragColor = vec4(vec3(occlusion),1.0);',
                '}',
                ''
            ].join( '\n' );

            var program = new Program(
                new Shader( 'VERTEX_SHADER', vertexshader ),
                new Shader( 'FRAGMENT_SHADER', fragmentshader ) );

            stateSet.setAttributeAndModes( program );
            this._dirty = false;
        }
    } );



    Composer.Filter.SSAO8 = function ( options ) {
        Composer.Filter.SSAO.call( this, options );
    };

    Composer.Filter.SSAO8.prototype = MACROUTILS.objectInehrit( Composer.Filter.SSAO.prototype, {
        buildGeometry: function ( quad ) {
            quad.getAttributes().TexCoord1 = this._texCoord1;
            return quad;
        },
        build: function () {
            var stateSet = this._stateSet;
            var nbSamples = this._nbSamples;
            var kernel = new Array( nbSamples * 4 );
            //var angleLimit = this._angleLimit;
            ( function ( array ) {
                var v = [ 0.0, 0.0, 0.0 ];
                for ( var i = 0; i < nbSamples; i++ ) {
                    v[ 0 ] = 2.0 * ( Math.random() - 0.5 );
                    v[ 1 ] = 2.0 * ( Math.random() - 0.5 );
                    v[ 2 ] = Math.random();

                    Vec3.normalize( v, v );
                    var scale = Math.max( i / nbSamples, 0.1 );
                    scale = 0.1 + ( 1.0 - 0.1 ) * ( scale * scale );
                    array[ i * 3 + 0 ] = v[ 0 ];
                    array[ i * 3 + 1 ] = v[ 1 ];
                    array[ i * 3 + 2 ] = v[ 2 ];
                    array[ i * 3 + 3 ] = scale;
                }
            } )( kernel );

            //var sizeNoise = this._noiseTextureSize;
            stateSet.setTextureAttributeAndModes( 2, this._noiseTexture );
            var uniform = stateSet.getUniform( 'noiseSampling' );
            if ( uniform === undefined ) {
                uniform = Uniform.createFloat2( [ this._size[ 0 ] / this._noiseTextureSize, this._size[ 1 ] / this._noiseTextureSize ], 'noiseSampling' );
                stateSet.addUniform( uniform );
            } else {
                uniform.set( [ this._size[ 0 ] / this._noiseTextureSize, this._size[ 1 ] / this._noiseTextureSize ] );
                uniform.dirty();
            }
            var vertexshader = [
                '',
                '#ifdef GL_ES',
                'precision highp float;',
                '#endif',
                'attribute vec3 Vertex;',
                'attribute vec2 TexCoord0;',
                'attribute vec3 TexCoord1;',
                'varying vec2 FragTexCoord0;',
                'varying vec3 FragTexCoord1;',
                'uniform mat4 ModelViewMatrix;',
                'uniform mat4 ProjectionMatrix;',
                'void main(void) {',
                '  gl_Position = ProjectionMatrix * ModelViewMatrix * vec4(Vertex,1.0);',
                '  FragTexCoord0 = TexCoord0;',
                '  FragTexCoord1 = TexCoord1;',
                '}',
                ''
            ].join( '\n' );

            var kernelglsl = [];
            for ( var i = 0; i < nbSamples; i++ ) {
                kernelglsl.push( 'kernel[' + i + '] = vec4(' + kernel[ i * 3 ] + ',' + kernel[ i * 3 + 1 ] + ', ' + kernel[ i * 3 + 2 ] + ', ' + kernel[ i * 3 + 3 ] + ');' );
            }
            kernelglsl = kernelglsl.join( '\n' );

            //var ssaoRadiusMin = this._sceneRadius * 0.002;
            //var ssaoRadiusMax = this._sceneRadius * 0.05;
            //var ssaoRadiusStep = ( ssaoRadiusMax - ssaoRadiusMin ) / 200.0;

            var fragmentshader = [
                '',
                Composer.Filter.defaultFragmentShaderHeader,
                'varying vec3 FragTexCoord1;',
                'uniform sampler2D Texture1;',
                'uniform sampler2D Texture2;',
                'uniform mat4 projection;',
                'uniform vec2 noiseSampling;',
                'uniform float Power;', //'+ '{ 'min': 0.1, 'max': 16.0, 'step': 0.1, 'value': 1.0 }',
                'uniform float Radius;', //'+ '{ 'min': ' + ssaoRadiusMin +', 'max': ' + ssaoRadiusMax + ', 'step': '+ ssaoRadiusStep + ', 'value': 0.01 }',
                'uniform float AngleLimit;',
                '#define NB_SAMPLES ' + this._nbSamples,
                'float depth;',
                'float znear, zfar, zrange;',
                'vec3 normal;',
                'vec3 position;',
                'vec4 kernel[' + nbSamples + '];',

                Composer.Filter.shaderUtils,

                'mat3 computeBasis()',
                '{',
                '  vec2 uvrand = FragTexCoord0*noiseSampling;',
                '  //uvrand = rand(gl_FragCoord.xy);',
                '  vec3 rvec = texture2D(Texture2, uvrand*2.0).xyz*2.0-vec3(1.0);',
                '  //vec3 rvec = normalize(vec3(uvrand,0.0));',
                '  vec3 tangent = normalize(rvec - normal * dot(rvec, normal));',
                '  vec3 bitangent = cross(normal, tangent);',
                '  mat3 tbn = mat3(tangent, bitangent, normal);',
                '  return tbn;',
                '}',

                'float getDepthValue(vec4 v) {',
                '  float depth = unpack4x8ToFloat(v);',
                '  depth = depth*zrange+znear;',
                '  //depth = depth*zrange;',
                '  return -depth;',
                '}',

                'void main (void)',
                '{',
                kernelglsl,
                '  vec4 p = texture2D(Texture0, FragTexCoord0);',
                '  if (dot(p,p) < 0.001) { ',
                '     gl_FragColor = vec4(1.0,1.0,1.0,0.0);',
                '     return;',
                '  }',
                '  znear = projection[3][2] / (projection[2][2]-1.0);',
                '  zfar = projection[3][2] / (projection[2][2]+1.0);',
                '  zrange = zfar-znear;',
                '  depth = getDepthValue(texture2D(Texture1, FragTexCoord0));',
                //B = (A - znear)/(zfar-znear);',
                //B = A/(zfar-znear) - znear/(zfar-znear);',
                //B+ znear/(zfar-znear) = A/(zfar-znear) ;',
                //(zfar-znear)*(B+ znear/(zfar-znear)) = A ;',
                //(zfar-znear)*B+ znear = A ;',

                '  if ( -depth < znear) {',
                '     gl_FragColor = vec4(1.0,1.0,1.0,0.0);',
                '     return;',
                '  }',

                '  normal = decodeNormal(unpack4x8To2Float(p));',

                '  position = -FragTexCoord1*depth;',
                '  position.z = -position.z;',

                '',
                ' mat3 tbn = computeBasis();',
                ' float occlusion = 0.0;',
                ' for (int i = 0; i < NB_SAMPLES; i++) {',
                '    vec3 vecKernel = vec3(kernel[i]);',
                '    vecKernel[2] = max(AngleLimit,vecKernel[2]);',
                '    vec3 sample = tbn * vec3(vecKernel);',
                '    vec3 dir = sample;',
                '    float w = dot(dir, normal);',
                '    float dist = 1.0-kernel[i].w;',
                '    w *= dist*dist*Power;',
                '    sample = dir * float(Radius) + position.xyz;',

                '    vec4 offset = projection * vec4(sample,1.0);',
                '    offset.xy /= offset.w;',
                '    offset.xy = offset.xy * 0.5 + 0.5;',

                '    float sample_depth = getDepthValue(texture2D(Texture1, offset.xy));',
                '    float range_check = abs(sample.z - sample_depth) < float(Radius) ? 1.0 : 0.0;',
                '    occlusion += (sample_depth > sample.z ? 1.0 : 0.0) * range_check*w;',

                ' }',
                ' occlusion = 1.0 - (occlusion / float(NB_SAMPLES));',
                ' gl_FragColor = vec4(vec3(occlusion),1.0);',
                '}',
                ''
            ].join( '\n' );

            var program = new Program(
                new Shader( 'VERTEX_SHADER', vertexshader ),
                new Shader( 'FRAGMENT_SHADER', fragmentshader ) );

            stateSet.setAttributeAndModes( program );
            this._dirty = false;
        }
    } );

    return Composer;
} );

define( 'osgUtil/IntersectVisitor',[
    'osg/Utils',
    'osg/NodeVisitor',
    'osg/Matrix',
    'osg/Vec3',
    'osgUtil/TriangleIntersect'
], function( MACROUTILS, NodeVisitor, Matrix, Vec3, TriangleIntersect ) {

    var IntersectVisitor = function() {
        NodeVisitor.call( this );
        this.matrix = [];
        this.hits = [];
        this.nodePath = [];
    };
    IntersectVisitor.prototype = MACROUTILS.objectInehrit( NodeVisitor.prototype, {
        addLineSegment: function( start, end ) {
            this.start = start;
            this.end = end;
        },
        intersectSegmentWithSphere: ( function() {
            var sm = [ 0.0, 0.0, 0.0 ];
            var se = [ 0.0, 0.0, 0.0 ];
            return function( start, end, bsphere ) {
                // test for _start inside the bounding sphere
                Vec3.sub( start, bsphere.center(), sm );
                var c = Vec3.length2( sm ) - bsphere.radius2();
                if ( c < 0.0 ) {
                    return true;
                }

                // solve quadratic equation
                Vec3.sub( end, start, se );
                var a = Vec3.length2( se );
                var b = Vec3.dot( sm, se ) * 2.0;
                var d = b * b - 4.0 * a * c;
                // no intersections if d<0
                if ( d < 0.0 ) {
                    return false;
                }

                // compute two solutions of quadratic equation
                d = Math.sqrt( d );
                var div = 1.0 / ( 2.0 * a );
                var r1 = ( -b - d ) * div;
                var r2 = ( -b + d ) * div;

                // return false if both intersections are before the ray start
                if ( r1 <= 0.0 && r2 <= 0.0 ) {
                    return false;
                }

                if ( r1 >= 1.0 && r2 >= 1.0 ) {
                    return false;
                }
                return true;
            };
        } )(),
        pushModelMatrix: function( matrix ) {
            if ( this.matrix.length > 0 ) {
                var m = Matrix.copy( this.matrix[ this.matrix.length - 1 ] );
                Matrix.preMult( m, matrix );
                this.matrix.push( m );
            } else {
                this.matrix.push( matrix );
            }
        },
        getModelMatrix: function() {
            if ( this.matrix.length === 0 ) {
                return Matrix.create();
            }
            return this.matrix[ this.matrix.length - 1 ];
        },
        popModelMatrix: function() {
            return this.matrix.pop();
        },
        getWindowMatrix: function() {
            return this.windowMatrix;
        },
        getProjectionMatrix: function() {
            return this.projectionMatrix;
        },
        getViewMatrix: function() {
            return this.viewMatrix;
        },
        intersectSegmentWithShape: function( start, end, shape ) {
            return shape.intersect( start, end, this.hits, this.nodePath );
        },
        intersectSegmentWithGeometry: function( start, end, geometry ) {
            var ti = new TriangleIntersect();
            ti.setNodePath( this.nodePath );
            ti.set( start, end );
            ti.apply( geometry );
            var l = ti.hits.length;
            if ( l > 0 ) {
                for ( var i = 0; i < l; i++ ) {
                    this.hits.push( ti.hits[ i ] );
                }
                return true;
            }
            return false;
        },
        pushCamera: function( camera ) {
            // we should support hierarchy of camera
            // but right now we want just simple picking on main
            // camera
            this.projectionMatrix = camera.getProjectionMatrix();
            this.viewMatrix = camera.getViewMatrix();

            var vp = camera.getViewport();
            if ( vp !== undefined ) {
                this.windowMatrix = vp.computeWindowMatrix();
            }
        },
        applyCamera: function( camera ) {
            // we should support hierarchy of camera
            // but right now we want just simple picking on main
            // camera
            this.pushCamera( camera );
            this.traverse( camera );
        },

        applyNode: function( node, ns, ne ) {
            if ( node.getMatrix ) {
                this.pushModelMatrix( node.getMatrix() );
            }

            if ( node.primitives ) {
                var kdtree = node.getShape();
                if ( kdtree ) {
                    this.intersectSegmentWithShape( ns, ne, kdtree );
                } else
                    this.intersectSegmentWithGeometry( ns, ne, node );
            }

            if ( node.traverse ) {
                this.traverse( node );
            }

            if ( node.getMatrix ) {
                this.popModelMatrix();
            }
        },

        transformRay: (function() {
            var inv = Matrix.create();
            return function(tStart, tEnd) {
                Matrix.copy(this.getWindowMatrix(), inv);
                Matrix.preMult(inv, this.getProjectionMatrix());
                Matrix.preMult(inv, this.getViewMatrix());
                Matrix.preMult(inv, this.getModelMatrix());

                var valid = Matrix.inverse(inv, inv);
                // if matrix is invalid do nothing on this node
                if (!valid) {
                    return false;
                }

                Matrix.transformVec3(inv, this.start, tStart);
                Matrix.transformVec3(inv, this.end, tEnd);

                return true;
            };
        })(),
        apply: ( function() {
            var ns = [ 0.0, 0.0, 0.0 ];
            var ne = [ 0.0, 0.0, 0.0 ];
            return function( node ) {
                if ( this.transformRay( ns, ne ) === false ) {
                    return;
                }

                if ( this.enterNode( node, ns, ne ) === false ) {
                    return;
                }

                if ( node.getViewMatrix ) { // Camera/View
                    this.applyCamera( node );
                } else {
                    this.applyNode( node, ns, ne );
                }
            };
        } )(),

        enterNode: function( node, ns, ne ) {
            return this.intersectSegmentWithSphere( ns, ne, node.getBound() );
        }
    } );

    return IntersectVisitor;
} );

define( 'osgUtil/ParameterVisitor',[
    'osg/Utils',
    'osg/Notify',
    'osg/Uniform',
    'osg/NodeVisitor'
], function ( MACROUTILS, Notify, Uniform, NodeVisitor ) {

    var ArraySlider = function ( params ) {
        if ( params !== undefined ) {
            if ( params.object !== undefined && params.field !== undefined ) {
                this.createInternalSlider( params );
            }
            this._uniform = this.createInternalSliderUniform( params );
        }
    };

    ArraySlider.prototype = {
        setTargetHTML: function ( target ) {
            this.parent = target;
        },
        addToDom: function ( content ) {
            var mydiv = document.createElement( 'div' );
            mydiv.innerHTML = content;
            this.parent.appendChild( mydiv );
        },

        getValue: function ( name ) {
            if ( window.localStorage ) {
                var value = window.localStorage.getItem( name );
                return value;
            }
            return null;
        },
        setValue: function ( name, value ) {
            if ( window.localStorage ) {
                window.localStorage.setItem( name, value );
            }
        },
        createHTMLSlider: function ( param, value, nameIndex, cbnameIndex ) {
            var input = '<div>NAME [ MIN - MAX ] <input type="range" min="MIN" max="MAX" value="VALUE" step="STEP" onchange="ONCHANGE" /><span id="UPDATE"></span></div>';
            var min = param.min;
            var max = param.max;
            var step = param.step;
            var name = nameIndex;
            var cbname = cbnameIndex;
            var onchange = cbname + '(this.value)';
            input = input.replace( /MIN/g, min );
            input = input.replace( /MAX/g, ( max + step ) );
            input = input.replace( 'STEP', step );
            input = input.replace( 'VALUE', value );
            input = input.replace( /NAME/g, name );
            input = input.replace( /UPDATE/g, cbname );
            input = input.replace( 'ONCHANGE', onchange );
            return input;
        },

        createUniformFunction: function ( param, name, index, uniform, cbnameIndex ) {
            var self = this;
            return ( function () {
                var cname = name;
                var cindex = index;
                var cuniform = uniform;
                var id = cbnameIndex;
                var func = function ( value ) {
                    cuniform.get()[ cindex ] = value;
                    cuniform.dirty();
                    Notify.debug( cname + ' value ' + value );
                    document.getElementById( cbnameIndex ).innerHTML = Number( value ).toFixed( 4 );
                    self.setValue( id, value );
                    if ( param.onchange !== undefined ) {
                        param.onchange( cuniform.get() );
                    }
                    // store the value to localstorage
                };
                return func;
            } )();
        },

        createFunction: function ( param, name, index, object, field, cbnameIndex ) {
            var self = this;
            return ( function () {
                var cname = name;
                //var cindex = index;
                var cfield = field;
                var id = cbnameIndex;
                var obj = object;
                var func = function ( value ) {
                    if ( typeof ( value ) === 'string' ) {
                        value = parseFloat( value );
                    }

                    if ( typeof ( object[ cfield ] ) === 'number' ) {
                        obj[ cfield ] = value;
                    } else {
                        obj[ cfield ][ index ] = value;
                    }
                    Notify.debug( cname + ' value ' + value );
                    document.getElementById( cbnameIndex ).innerHTML = Number( value ).toFixed( 4 );
                    self.setValue( id, value );
                    if ( param.onchange !== undefined ) {
                        param.onchange( obj[ cfield ] );
                    }

                    // store the value to localstorage
                };
                return func;
            } )();
        },

        getCallbackName: function ( name, prgId ) {
            return 'change_' + prgId + '_' + name;
        },

        copyDefaultValue: function ( param ) {
            var uvalue = param.value;
            if ( Array.isArray( param.value ) ) {
                uvalue = param.value.slice();
            } else {
                uvalue = [ uvalue ];
            }
            return uvalue;
        },

        createInternalSliderUniform: function ( param ) {
            var uvalue = param.value;
            var uniform = param.uniform;
            if ( uniform === undefined ) {
                var type = param.type;
                type = type.charAt( 0 ).toUpperCase() + type.slice( 1 );
                uniform = Uniform[ 'create' + type ]( uvalue, param.name );
            }

            var cbname = this.getCallbackName( param.name, param.id );
            var dim = uvalue.length;
            for ( var i = 0; i < dim; i++ ) {

                var istring = i.toString();
                var nameIndex = param.name + istring;
                var cbnameIndex = cbname + istring;

                // default value
                var value = uvalue[ i ];

                // read local storage value if it exist
                var readValue = this.getValue( cbnameIndex );
                if ( readValue !== null ) {
                    value = readValue;
                } else if ( param.uniform && param.uniform.get()[ i ] !== undefined ) {
                    // read value from original uniform
                    value = param.uniform.get()[ i ];
                }

                var dom = this.createHTMLSlider( param, value, nameIndex, cbnameIndex );
                this.addToDom( dom );
                window[ cbnameIndex ] = this.createUniformFunction( param, nameIndex, i, uniform, cbnameIndex );
                Notify.log( nameIndex + ' ' + value );
                window[ cbnameIndex ]( value );
            }
            this.uniform = uniform;
            return uniform;
        },

        createInternalSlider: function ( param ) {
            var uvalue = param.value;
            var name = param.name;
            var id = param.id;
            var dim = uvalue.length;
            var cbname = this.getCallbackName( name, id );
            var object = param.object;
            var field = param.field;
            for ( var i = 0; i < dim; i++ ) {

                var istring = i.toString();
                var nameIndex = name + istring;
                var cbnameIndex = cbname + istring;

                // default value
                var value = uvalue[ i ];

                // read local storage value if it exist
                var readValue = this.getValue( cbnameIndex );
                if ( readValue !== null ) {
                    value = readValue;
                } else {
                    if ( typeof object[ field ] === 'number' ) {
                        value = object[ field ];
                    } else {
                        value = object[ field ][ i ];
                    }
                }

                var dom = this.createHTMLSlider( param, value, nameIndex, cbnameIndex );
                this.addToDom( dom );
                window[ cbnameIndex ] = this.createFunction( param, nameIndex, i, object, field, cbnameIndex );
                Notify.log( nameIndex + ' ' + value );
                window[ cbnameIndex ]( value );
            }
        },

        createSlider: function ( param ) {
            if ( param.html !== undefined ) {
                this.setTargetHTML( param.html );
            }
            if ( param.id === undefined ) {
                param.id = param.name;
            }
            param.value = this.copyDefaultValue( param );
            if ( param.type !== undefined ) {
                return this.createInternalSliderUniform( param );
            } else {
                if ( param.object === undefined ) {
                    param.object = {
                        'data': param.value
                    };
                    param.field = 'data';
                }
                return this.createInternalSlider( param );
            }
        }
    };


    var ParameterVisitor = function () {
        NodeVisitor.call( this );

        this.arraySlider = new ArraySlider();
        this.setTargetHTML( document.body );
    };

    ParameterVisitor.createSlider = function ( param ) {
        ( new ArraySlider() ).createSlider( param );
    };

    ParameterVisitor.prototype = MACROUTILS.objectInehrit( NodeVisitor.prototype, {

        setTargetHTML: function ( html ) {
            this.targetHTML = html;
            this.arraySlider.setTargetHTML( this.targetHTML );
        },

        getUniformList: function ( str, map ) {

            //var txt='uniform float Power; // { min: 0.1, max: 2.0, step: 0.1, value: [0,0,0]  }';

            var re1 = '(uniform)'; // Word 1
            var re2 = '.*?'; // Non-greedy match on filler
            var re3 = '((?:[a-z][a-z]+))'; // Word 2
            var re4 = '.*?'; // Non-greedy match on filler
            var re5 = '((?:[a-z][a-z]+))'; // Word 3
            var re6 = '.*?'; // Non-greedy match on filler
            var re7 = '.'; // Uninteresting: c
            var re8 = '.*?'; // Non-greedy match on filler
            var re9 = '.'; // Uninteresting: c
            var re10 = '.*?'; // Non-greedy match on filler
            var re11 = '(.)'; // Any Single Character 1
            var re12 = '(.)'; // Any Single Character 2
            var re13 = '.*?'; // Non-greedy match on filler
            var re14 = '(\\{.*?\\})'; // Curly Braces 1

            var p = new RegExp( re1 + re2 + re3 + re4 + re5 + re6 + re7 + re8 + re9 + re10 + re11 + re12 + re13 + re14, [ 'g' ] );
            var r = str.match( p );
            var list = map;

            var createGetter = function( value ) {
                return function() { return value; };
            };

            if ( r !== null ) {
                var re = new RegExp( re1 + re2 + re3 + re4 + re5 + re6 + re7 + re8 + re9 + re10 + re11 + re12 + re13 + re14, [ 'i' ] );
                for ( var i = 0, l = r.length; i < l; i++ ) {
                    var result = r[ i ].match( re );
                    //var result = p.exec(str);
                    if ( result !== null ) {
                        //var word1 = result[ 1 ];
                        var type = result[ 2 ];
                        var name = result[ 3 ];
                        //var c1 = result[ 4 ];
                        //var c2 = result[ 5 ];
                        var json = result[ 6 ];

                        var param = JSON.parse( json );
                        param.type = type;
                        param.name = name;
                        var value = param.value;
                        param.value = createGetter( value );
                        list[ name ] = param;
                    }
                }
            }
            return list;
        },

        getUniformFromStateSet: function ( stateSet, uniformMap ) {
            var maps = stateSet.getUniformList();
            if ( !maps ) {
                return;
            }
            var keys = window.Object.keys( uniformMap );
            for ( var i = 0, l = keys.length; i < l; i++ ) {
                var k = keys[ i ];
                // get the first one found in the tree
                if ( maps[ k ] !== undefined && uniformMap[ k ].uniform === undefined ) {
                    uniformMap[ k ].uniform = maps[ k ].object;
                }
            }
        },

        findExistingUniform: function ( node, uniformMap ) {
            var BackVisitor = function () {
                NodeVisitor.call( this, NodeVisitor.TRAVERSE_PARENTS );
            };
            BackVisitor.prototype = MACROUTILS.objectInehrit( NodeVisitor.prototype, {
                setUniformMap: function ( map ) {
                    this.uniformMap = map;
                },
                apply: function ( node ) {
                    var stateSet = node.getStateSet();
                    if ( stateSet ) {
                        ParameterVisitor.prototype.getUniformFromStateSet( stateSet, this.uniformMap );
                    }
                    this.traverse( node );
                }
            } );
            var visitor = new BackVisitor();
            visitor.setUniformMap( uniformMap );
            node.accept( visitor );
        },

        applyProgram: function ( node, stateset ) {
            var program = stateset.getAttribute( 'Program' );
            var programName = program.getName();
            //var string = program.getVertexShader().getText();
            var uniformMap = {};
            this.getUniformList( program.getVertexShader().getText(), uniformMap );
            this.getUniformList( program.getFragmentShader().getText(), uniformMap );


            var keys = window.Object.keys( uniformMap );

            if ( programName === undefined ) {
                var hashCode = function ( str ) {
                    var hash = 0;
                    var chara = 0;
                    if ( str.length === 0 ) {
                        return hash;
                    }
                    for ( i = 0; i < str.length; i++ ) {
                        chara = str.charCodeAt( i );
                        /*jshint bitwise: false */
                        hash = ( ( hash << 5 ) - hash ) + chara;
                        hash = hash & hash; // Convert to 32bit integer
                        /*jshint bitwise: true */
                    }
                    if ( hash < 0 ) {
                        hash = -hash;
                    }
                    return hash;
                };
                var str = keys.join( '' );
                programName = hashCode( str ).toString();
            }

            this.findExistingUniform( node, uniformMap );

            var addedSlider = false;
            for ( var i = 0; i < keys.length; i++ ) {
                var k = keys[ i ];
                var entry = uniformMap[ k ];
                var type = entry.type;
                var name = entry.name;
                entry.id = programName;
                var uniform = this.arraySlider.createSlider( entry );
                if ( false ) {
                    uniform = this.arraySlider.createSlider( {
                        name: name,
                        type: type,
                        id: programName,
                        uniform: entry.uniform
                    } );
                }
                if ( entry.uniform === undefined && uniform ) {
                    stateset.addUniform( uniform );
                }
                addedSlider = true;
            }

            // add a separator
            if ( addedSlider ) {
                var mydiv = document.createElement( 'div' );
                mydiv.innerHTML = '<p> </p>';
                this.targetHTML.appendChild( mydiv );
            }

            Notify.log( uniformMap );
        },


        applyStateSet: function ( node, stateset ) {
            if ( stateset.getAttribute( 'Program' ) !== undefined ) {
                this.applyProgram( node, stateset );
            }
        },

        apply: function ( node ) {
            var element = this.targetHTML;
            if ( element === undefined || element === null ) {
                return;
            }

            var st = node.getStateSet();
            if ( st !== undefined ) {
                this.applyStateSet( node, st );
            }

            this.traverse( node );
        }
    } );

    return ParameterVisitor;
} );

define( 'osgUtil/osgUtil',[
    'osgUtil/Composer',
    'osgUtil/IntersectVisitor',
    'osgUtil/ParameterVisitor',
    'osgUtil/TriangleIntersect'
], function( Composer, IntersectVisitor, ParameterVisitor, TriangleIntersect ) {

    var osgUtil = {};

    osgUtil.Composer = Composer;
    osgUtil.IntersectVisitor = IntersectVisitor;
    osgUtil.ParameterVisitor = ParameterVisitor;
    osgUtil.TriangleIntersect = TriangleIntersect;

    return osgUtil;
} );

define( 'osgViewer/View',[
    'osg/Camera',
    'osg/Node',
    'osg/FrameStamp',
    'osg/Material',
    'osg/Depth',
    'osg/BlendFunc',
    'osg/CullFace',
    'osg/Viewport',
    'osg/Matrix',
    'osg/Light',
    'osg/WebGLCaps',
    'osgUtil/IntersectVisitor'
], function ( Camera, Node, FrameStamp, Material, Depth, BlendFunc, CullFace, Viewport, Matrix, Light, WebGLCaps, IntersectVisitor ) {

    var View = function () {
        this._graphicContext = undefined;
        this._camera = new Camera();
        this._scene = new Node();
        this._sceneData = undefined;
        this._frameStamp = new FrameStamp();
        this._lightingMode = undefined;
        this._manipulator = undefined;
        this._webGLCaps = undefined;


        this.setLightingMode( View.LightingMode.HEADLIGHT );

        this._scene.getOrCreateStateSet().setAttributeAndMode( new Material() );
        this._scene.getOrCreateStateSet().setAttributeAndMode( new Depth() );
        this._scene.getOrCreateStateSet().setAttributeAndMode( new BlendFunc() );
        this._scene.getOrCreateStateSet().setAttributeAndMode( new CullFace() );
    };

    View.LightingMode = {
        NO_LIGHT: 0,
        HEADLIGHT: 1,
        SKY_LIGHT: 2
    };

    View.prototype = {
        setGraphicContext: function ( gc ) {
            this._graphicContext = gc;
        },
        getGraphicContext: function () {
            return this._graphicContext;
        },
        getWebGLCaps: function () {
            return this._webGLCaps;
        },
        initWebGLCaps: function( gl ) {
            this._webGLCaps = new WebGLCaps();
            this._webGLCaps.init( gl );
        },

        computeCanvasSize: function( canvas ) {

            var clientWidth, clientHeight;
            if ( this._options.getBoolean('fullscreen') === true ) {
                clientWidth = window.innerWidth;
                clientHeight = window.innerHeight;
            } else {
                clientWidth = canvas.clientWidth;
                clientHeight = canvas.clientHeight;
            }

            if ( clientWidth < 1 ) clientWidth = 1;
            if ( clientHeight < 1 ) clientHeight = 1;

            var devicePixelRatio = 1;
            if ( this._options.getBoolean( 'useDevicePixelRatio') ) {
                devicePixelRatio = window.devicePixelRatio || 1;
            }

            var widthPixel = clientWidth * devicePixelRatio;
            var heightPixel = clientHeight * devicePixelRatio;

            canvas.width = widthPixel;
            canvas.height = heightPixel;

            canvas.style.width = widthPixel / devicePixelRatio;
            canvas.style.height = heightPixel / devicePixelRatio;
        },

        setUpView: function ( canvas ) {

            this.computeCanvasSize( canvas );

            var ratio = canvas.width / canvas.height;
            this._camera.setViewport( new Viewport( 0, 0, canvas.width, canvas.height ) );
            Matrix.makeLookAt( [ 0, 0, -10 ], [ 0, 0, 0 ], [ 0, 1, 0 ], this._camera.getViewMatrix() );
            Matrix.makePerspective( 55, ratio, 1.0, 1000.0, this._camera.getProjectionMatrix() );
        },

        /**
         * X = 0 at the left
         * Y = 0 at the BOTTOM
         */
        computeIntersections: function ( x, y, traversalMask ) {
            /*jshint bitwise: false */
            if ( traversalMask === undefined ) {
                traversalMask = ~0;
            }
            /*jshint bitwise: true */

            var iv = new IntersectVisitor();
            iv.setTraversalMask( traversalMask );
            iv.addLineSegment( [ x, y, 0.0 ], [ x, y, 1.0 ] );
            iv.pushCamera( this._camera );
            this._sceneData.accept( iv );
            return iv.hits;
        },

        setFrameStamp: function ( frameStamp ) {
            this._frameStamp = frameStamp;
        },
        getFrameStamp: function () {
            return this._frameStamp;
        },
        setCamera: function ( camera ) {
            this._camera = camera;
        },
        getCamera: function () {
            return this._camera;
        },

        setSceneData: function ( node ) {
            this._scene.removeChildren();
            this._scene.addChild( node );
            this._sceneData = node;
        },
        getSceneData: function () {
            return this._sceneData;
        },
        getScene: function () {
            return this._scene;
        },

        getManipulator: function () {
            return this._manipulator;
        },
        setManipulator: function ( manipulator ) {
            this._manipulator = manipulator;
        },

        getLight: function () {
            return this._light;
        },
        setLight: function ( light ) {
            this._light = light;
            if ( this._lightingMode !== View.LightingMode.NO_LIGHT ) {
                this._scene.getOrCreateStateSet().setAttributeAndMode( this._light );
            }
        },
        getLightingMode: function () {
            return this._lightingMode;
        },
        setLightingMode: function ( lightingMode ) {
            if ( this._lightingMode !== lightingMode ) {
                this._lightingMode = lightingMode;
                if ( this._lightingMode !== View.LightingMode.NO_LIGHT ) {
                    if ( !this._light ) {
                        this._light = new Light();
                        this._light.setAmbient( [ 0.2, 0.2, 0.2, 1.0 ] );
                        this._light.setDiffuse( [ 0.8, 0.8, 0.8, 1.0 ] );
                        this._light.setSpecular( [ 0.5, 0.5, 0.5, 1.0 ] );
                    }
                } else {
                    this._light = undefined;
                }
            }
        }

    };

    return View;
} );

define( 'osgViewer/eventProxy/GamePad',[
    'osg/Notify'
], function ( Notify ) {

    var GamePad = function ( viewer ) {
        this._viewer = viewer;
        this._type = 'GamePad';
        this._enable = true;
    };

    GamePad.prototype = {
        init: function ( /*args*/ ) {

            var gamepadSupportAvailable = !! navigator.webkitGetGamepads || !! navigator.webkitGamepads;
            // || (navigator.userAgent.indexOf('Firefox/') != -1); // impossible to detect Gamepad API support in FF
            if ( !gamepadSupportAvailable ) return;

        },

        isValid: function () {
            if ( !this._enable )
                return false;

            var manipulator = this._viewer.getManipulator();
            if ( !manipulator )
                return false;

            var constrollerList = manipulator.getControllerList();
            if ( !constrollerList[ this._type ] )
                return false;

            return true;
        },

        getManipulatorController: function () {
            return this._viewer.getManipulator().getControllerList()[ this._type ];
        },

        webkitGamepadPoll: function () {
            var rawGamepads = ( navigator.webkitGetGamepads && navigator.webkitGetGamepads() ) || navigator.webkitGamepads;
            if ( !rawGamepads ) {
                return;
            }

            if ( rawGamepads[ 0 ] ) {
                if ( !this._gamepad ) {
                    this.onGamepadConnect( {
                        gamepad: rawGamepads[ 0 ]
                    } );
                }
                this._gamepad = rawGamepads[ 0 ];
            } else if ( this._gamepad ) {
                this.onGamepadDisconnect( {
                    gamepad: this._gamepad
                } );
            }
        },

        onGamepadConnect: function ( evt ) {
            this._gamepad = evt.gamepad;
            Notify.log( 'Detected new gamepad!', this._gamepad );
        },

        onGamepadDisconnect: function ( /*evt*/ ) {
            this._gamepad = false;
            Notify.log( 'Gamepad disconnected', this._gamepad );
        },
        getGamePad: function () {
            return this._gamepad;
        },

        // Called in each frame
        update: function () {

            // necessary
            this.webkitGamepadPoll();

            if ( !this._gamepad )
                return;

            var manipulatorAdapter = this.getManipulatorController();
            //manipulatorAdapter.setEventProxy(this);
            if ( manipulatorAdapter.update ) {
                manipulatorAdapter.update( this );
            }
        }
    };
    return GamePad;
} );

define( 'osgViewer/eventProxy/Hammer',[
    'Hammer'
], function ( Hammer ) {

    var HammerController = function ( viewer ) {
        this._enable = true;
        this._viewer = viewer;
        this._type = 'Hammer';

        this._eventNode = undefined;

    };

    HammerController.prototype = {
        init: function ( args ) {

            /*jshint camelcase: false */
            var options = {
                prevent_default: true,
                drag_max_touches: 2,
                transform_min_scale: 0.08,
                transform_min_rotation: 180,
                transform_always_block: true,
                hold: false,
                release: false,
                swipe: false,
                tap: false
            };
            /*jshint camelcase: true */

            this._eventNode = args.eventNode;
            if ( this._eventNode ) {
                this._hammer = new Hammer( this._eventNode, options );
            }
        },

        isValid: function () {
            if ( this._enable && this._viewer.getManipulator() && this._viewer.getManipulator().getControllerList()[ this._type ] )
                return true;
            return false;
        },
        getManipulatorController: function () {
            return this._viewer.getManipulator().getControllerList()[ this._type ];
        },

        // use the update to set the input device to mouse controller
        // it's needed to compute size
        update: function () {
            if ( !this.isValid() )
                return;

            // we pass directly hammer object
            this.getManipulatorController().setEventProxy( this._hammer );
        }

    };
    return HammerController;
} );

define( 'Leap',[],function ( ) {
    return window.Leap;
} );

define( 'osgViewer/eventProxy/LeapMotion',[
    'Leap',
    'osg/Notify'
], function ( Leap, Notify ) {

    var LeapMotion = function ( viewer ) {
        this._viewer = viewer;
        this._type = 'LeapMotion';
        this._enable = true;
    };

    LeapMotion.prototype = {
        init: function ( args ) {

            var self = this;
            this._controller = new Leap.Controller( {
                enableGestures: args.gestures || true,
                tryReconnectOnDisconnect: true,
                connectAttempts: 3
            } );
            this._controller.on( 'ready', function () {
                if ( args.readyCallback )
                    args.readyCallback( self._controller );
                self._leapMotionReady = true;
                Notify.info( 'leapmotion ready' );
            } );
            this._controller.loop( this._update.bind( this ) );
        },

        isValid: function () {
            if ( !this._enable )
                return false;

            var manipulator = this._viewer.getManipulator();
            if ( !manipulator )
                return false;

            var constrollerList = manipulator.getControllerList();
            if ( !constrollerList[ this._type ] )
                return false;

            return true;
        },
        getManipulatorController: function () {
            return this._viewer.getManipulator().getControllerList()[ this._type ];
        },

        // this is binded
        _update: function ( frame ) {
            if ( !frame.valid || !this.isValid() ) {
                return;
            }
            var manipulatorAdapter = this.getManipulatorController();
            if ( manipulatorAdapter.update ) {
                manipulatorAdapter.update( frame );
            }
        }
    };
    return LeapMotion;
} );

define( 'osgViewer/eventProxy/StandardMouseKeyboard',[], function () {

    var StandardMouseKeyboard = function ( viewer ) {
        this._enable = true;
        this._viewer = viewer;
        this._type = 'StandardMouseKeyboard';

        this._mouseEventNode = undefined;
        this._wheelEventNode = undefined;
        this._keyboardEventNode = undefined;
        this._eventList = [ 'mousedown', 'mouseup', 'mousemove', 'dblclick' ];
        this._mousePosition = [ 0, 0 ];
    };

    StandardMouseKeyboard.prototype = {
        init: function ( args ) {

            this.removeEventListeners( this._mouseEventNode, this._wheelEventNode, this._keyboardEventNode );

            var mouse = args.mouseEventNode;
            var mousewheel = args.wheelEventNode || mouse;
            var keyboard = args.keyboardEventNode || mouse;

            this.addEventListeners( mouse, mousewheel, keyboard );
            this._mouseEventNode = mouse;
            this._wheelEventNode = mousewheel;
            this._keyboardEventNode = keyboard;
        },

        addEventListeners: function ( mouse, mousewheel, keyboard ) {
            if ( mouse ) {
                for ( var i = 0, l = this._eventList.length; i < l; i++ ) {
                    var ev = this._eventList[ i ];
                    if ( this[ ev ] ) {
                        mouse.addEventListener( ev, this[ ev ].bind( this ), false );
                    }
                }
            }
            if ( mousewheel ) {
                mousewheel.addEventListener( 'DOMMouseScroll', this.mousewheel.bind( this ), false );
                mousewheel.addEventListener( 'mousewheel', this.mousewheel.bind( this ), false );
            }

            if ( keyboard ) {
                keyboard.addEventListener( 'keydown', this.keydown.bind( this ), false );
                keyboard.addEventListener( 'keyup', this.keyup.bind( this ), false );
            }
        },

        removeEventListeners: function ( mouse, mousewheel, keyboard ) {
            if ( mouse ) {
                for ( var i = 0, l = this._eventList.length; i < l; i++ ) {
                    var ev = this._eventList[ i ];
                    if ( this[ ev ] ) {
                        mouse.removeEventListener( ev, this[ ev ] );
                    }
                }
            }
            if ( mousewheel ) {
                mousewheel.removeEventListener( 'DOMMouseScroll', this.mousewheel );
                mousewheel.removeEventListener( 'mousewheel', this.mousewheel );
            }
            if ( keyboard ) {
                keyboard.removeEventListener( 'keydown', this.keydown );
                keyboard.removeEventListener( 'keyup', this.keyup );
            }
        },

        isValid: function () {
            if ( this._enable && this._viewer.getManipulator() && this._viewer.getManipulator().getControllerList()[ this._type ] )
                return true;
            return false;
        },
        getManipulatorController: function () {
            return this._viewer.getManipulator().getControllerList()[ this._type ];
        },
        keyup: function ( ev ) {
            if ( !this.isValid() )
                return;
            if ( this.getManipulatorController().keyup )
                return this.getManipulatorController().keyup( ev );
        },
        keydown: function ( ev ) {
            if ( !this.isValid() )
                return;
            if ( this.getManipulatorController().keydown )
                return this.getManipulatorController().keydown( ev );
        },

        mousedown: function ( ev ) {
            if ( !this.isValid() )
                return;
            if ( this.getManipulatorController().mousedown )
                return this.getManipulatorController().mousedown( ev );
        },

        mouseup: function ( ev ) {
            if ( !this.isValid() )
                return;
            if ( this.getManipulatorController().mouseup )
                return this.getManipulatorController().mouseup( ev );
        },

        mousemove: function ( ev ) {
            if ( !this.isValid() )
                return;
            if ( this.getManipulatorController().mousemove )
                return this.getManipulatorController().mousemove( ev );
        },

        dblclick: function ( ev ) {
            if ( !this.isValid() )
                return;
            if ( this.getManipulatorController().dblclick )
                return this.getManipulatorController().dblclick( ev );
        },

        mousewheel: function ( event ) {
            if ( !this.isValid() )
                return;

            var manipulatorAdapter = this.getManipulatorController();
            if ( !manipulatorAdapter.mousewheel )
                return;

            // from jquery
            var orgEvent = event || window.event,
                args = [].slice.call( arguments, 1 ),
                delta = 0,
                //returnValue = true,
                deltaX = 0,
                deltaY = 0;
            //event = $.event.fix(orgEvent);
            event.type = 'mousewheel';

            // Old school scrollwheel delta
            if ( event.wheelDelta ) {
                delta = event.wheelDelta / 120;
            }
            if ( event.detail ) {
                delta = -event.detail / 3;
            }

            // New school multidimensional scroll (touchpads) deltas
            deltaY = delta;

            // Gecko
            if ( orgEvent.axis !== undefined && orgEvent.axis === orgEvent.HORIZONTAL_AXIS ) {
                deltaY = 0;
                deltaX = -1 * delta;
            }

            // Webkit
            if ( orgEvent.wheelDeltaY !== undefined ) {
                deltaY = orgEvent.wheelDeltaY / 120;
            }
            if ( orgEvent.wheelDeltaX !== undefined ) {
                deltaX = -1 * orgEvent.wheelDeltaX / 120;
            }
            // Add event and delta to the front of the arguments
            args.unshift( event, delta, deltaX, deltaY );

            return this.getManipulatorController().mousewheel.apply( manipulatorAdapter, args );
        },

        divGlobalOffset: function ( obj ) {
            var x = 0,
                y = 0;
            x = obj.offsetLeft;
            y = obj.offsetTop;
            var body = document.getElementsByTagName( 'body' )[ 0 ];
            while ( obj.offsetParent && obj !== body ) {
                x += obj.offsetParent.offsetLeft;
                y += obj.offsetParent.offsetTop;
                obj = obj.offsetParent;
            }
            this._mousePosition[ 0 ] = x;
            this._mousePosition[ 1 ] = y;
            return this._mousePosition;
        },

        getPositionRelativeToCanvas: function ( e, result ) {
            var myObject = e.target;
            var posx, posy;
            if ( e.pageX || e.pageY ) {
                posx = e.pageX;
                posy = e.pageY;
            } else if ( e.clientX || e.clientY ) {
                posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
                posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
            }

            // posx and posy contain the mouse position relative to the document
            // Do something with this information
            var globalOffset = this.divGlobalOffset( myObject );
            posx = posx - globalOffset[ 0 ];
            posy = myObject.height - ( posy - globalOffset[ 1 ] );

            // NaN in camera check here
            if ( isNaN( posx ) || isNaN( posy ) ) {
                //debugger;
            }

            // copy data to result if need to keep result
            // else we use a tmp variable inside manipulator
            // that we override at each call
            if ( result === undefined ) {
                result = this._mousePosition;
            }
            result[ 0 ] = posx;
            result[ 1 ] = posy;
            return result;
        },

        // use the update to set the input device to mouse controller
        // it's needed to compute size
        update: function () {
            if ( !this.isValid() )
                return;

            this.getManipulatorController().setEventProxy( this );
        }

    };
    return StandardMouseKeyboard;
} );

define( 'vr',[],function ( ) {
    return window.vr;
} );

define( 'osgViewer/eventProxy/Oculus',[
    'vr'
], function ( vr ) {

    var Oculus = function ( viewer ) {
        this._viewer = viewer;
        this._type = 'Oculus';
        this._enable = true;
        this._vrstate = null;
    };

    Oculus.prototype = {
        init: function () {
            if ( !vr )
                return;
            this._vrstate = new vr.State();
        },

        getManipulatorController: function () {
            return this._viewer.getManipulator().getControllerList()[ this._type ];
        },

        isValid: function () {
            if ( !this._enable )
                return false;

            var manipulator = this._viewer.getManipulator();
            if ( !manipulator )
                return false;

            if ( !manipulator.getControllerList()[ this._type ] )
                return false;

            return true;
        },

        update: function () {
            if ( !this.isValid() )
                return;

            var vrstate = this._vrstate;
            if ( !vr || !vrstate )
                return;

            if ( !vr.pollState( vrstate ) || !vrstate.hmd.present )
                return;

            var manipulatorAdapter = this.getManipulatorController();
            if ( manipulatorAdapter.update ) {
                manipulatorAdapter.update( vrstate.hmd.rotation );
            }
        }
    };
    return Oculus;
} );
define( 'osgViewer/eventProxy/EventProxy',[
    'osgViewer/eventProxy/GamePad',
    'osgViewer/eventProxy/Hammer',
    'osgViewer/eventProxy/LeapMotion',
    'osgViewer/eventProxy/StandardMouseKeyboard',
    'osgViewer/eventProxy/Oculus'
], function ( GamePad, HammerOsg, LeapMotion, StandardMouseKeyboard, Oculus ) {

    return {
        GamePad: GamePad,
        Hammer: HammerOsg,
        LeapMotion: LeapMotion,
        StandardMouseKeyboard: StandardMouseKeyboard,
        Oculus: Oculus
    };
} );
/* jshint ignore:start */

define( 'osgViewer/webgl-utils',[], function () {

    /*
     * Copyright 2010, Google Inc.
     * All rights reserved.
     *
     * Redistribution and use in source and binary forms, with or without
     * modification, are permitted provided that the following conditions are
     * met:
     *
     *     * Redistributions of source code must retain the above copyright
     * notice, this list of conditions and the following disclaimer.
     *     * Redistributions in binary form must reproduce the above
     * copyright notice, this list of conditions and the following disclaimer
     * in the documentation and/or other materials provided with the
     * distribution.
     *     * Neither the name of Google Inc. nor the names of its
     * contributors may be used to endorse or promote products derived from
     * this software without specific prior written permission.
     *
     * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
     * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
     * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
     * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
     * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
     * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
     * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
     * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
     * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
     * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
     * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
     */


    /**
     * @fileoverview This file contains functions every webgl program will need
     * a version of one way or another.
     *
     * Instead of setting up a context manually it is recommended to
     * use. This will check for success or failure. On failure it
     * will attempt to present an approriate message to the user.
     *
     *       gl = WebGLUtils.setupWebGL(canvas);
     *
     * For animated WebGL apps use of setTimeout or setInterval are
     * discouraged. It is recommended you structure your rendering
     * loop like this.
     *
     *       function render() {
     *         window.requestAnimationFrame(render, canvas);
     *
     *         // do rendering
     *         ...
     *       }
     *       render();
     *
     * This will call your rendering function up to the refresh rate
     * of your display but will stop rendering if your app is not
     * visible.
     */

    var WebGLUtils = function () {

        /**
         * Creates the HTLM for a failure message
         * @param {string} canvasContainerId id of container of th
         *        canvas.
         * @return {string} The html.
         */
        var makeFailHTML = function ( msg ) {
            return '' +
                '<div style="margin: auto; width:500px;z-index:10000;margin-top:20em;text-align:center;">' + msg + '</div>';
            // return '' +
            //   '<table style="background-color: #8CE; width: 100%; height: 100%;"><tr>' +
            //   '<td align="center">' +
            //   '<div style="display: table-cell; vertical-align: middle;">' +
            //   '<div style="">' + msg + '</div>' +
            //   '</div>' +
            //   '</td></tr></table>';
        };

        /**
         * Mesasge for getting a webgl browser
         * @type {string}
         */
        var GET_A_WEBGL_BROWSER = '' +
            'This page requires a browser that supports WebGL.<br/>' +
            '<a href="http://get.webgl.org">Click here to upgrade your browser.</a>';

        /**
         * Mesasge for need better hardware
         * @type {string}
         */
        var OTHER_PROBLEM = '' +
            "It doesn't appear your computer can support WebGL.<br/>" +
            '<a href="http://get.webgl.org">Click here for more information.</a>';

        /**
         * Creates a webgl context. If creation fails it will
         * change the contents of the container of the <canvas>
         * tag to an error message with the correct links for WebGL.
         * @return {WebGLRenderingContext} The created context.
         */
        var setupWebGL = function (
            /** Element */
            canvas,
            /** WebGLContextCreationAttirbutes */
            opt_attribs,
            /** function:(msg) */
            opt_onError ) {
            function handleCreationError( msg ) {
                var container = document.getElementsByTagName( "body" )[ 0 ];
                //var container = canvas.parentNode;
                if ( container ) {
                    var str = window.WebGLRenderingContext ?
                        OTHER_PROBLEM :
                        GET_A_WEBGL_BROWSER;
                    if ( msg ) {
                        str += "<br/><br/>Status: " + msg;
                    }
                    container.innerHTML = makeFailHTML( str );
                }
            }

            opt_onError = opt_onError || handleCreationError;

            if ( canvas.addEventListener ) {
                canvas.addEventListener( "webglcontextcreationerror", function ( event ) {
                    opt_onError( event.statusMessage );
                }, false );
            }
            var context = create3DContext( canvas, opt_attribs );
            if ( !context ) {
                if ( !window.WebGLRenderingContext ) {
                    opt_onError( "" );
                } else {
                    opt_onError( "" );
                }
            }

            return context;
        };

        /**
         * Creates a webgl context.
         * @param {!Canvas} canvas The canvas tag to get context
         *     from. If one is not passed in one will be created.
         * @return {!WebGLContext} The created context.
         */
        var create3DContext = function ( canvas, opt_attribs ) {
            var names = [ "webgl", "experimental-webgl", "webkit-3d", "moz-webgl" ];
            var context = null;
            for ( var ii = 0; ii < names.length; ++ii ) {
                try {
                    context = canvas.getContext( names[ ii ], opt_attribs );
                } catch ( e ) {}
                if ( context ) {
                    break;
                }
            }
            return context;
        };

        return {
            create3DContext: create3DContext,
            setupWebGL: setupWebGL
        };
    }();

    /**
     * Provides requestAnimationFrame in a cross browser
     * way.
     */
    if ( !window.requestAnimationFrame ) {
        window.requestAnimationFrame = ( function () {
            return window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.oRequestAnimationFrame ||
                window.msRequestAnimationFrame ||
                function ( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element ) {
                    window.setTimeout( callback, 1000 / 60 );
            };
        } )();
    }

    if ( !window.cancelRequestAnimFrame ) {
        window.cancelRequestAnimFrame = ( function () {
            return window.cancelAnimationFrame ||
                window.webkitCancelRequestAnimationFrame ||
                window.mozCancelRequestAnimationFrame ||
                window.oCancelRequestAnimationFrame ||
                window.msCancelRequestAnimationFrame ||
                clearTimeout;
        } )();
    }

    if ( !Date.now ) {
        Date.now = function now() {
            return new Date().getTime();
        };
    }

    return WebGLUtils;
} );

/* jshint ignore:end */
;
/* jshint ignore:start */

define( 'osgViewer/webgl-debug',[

    'osg/Notify'

], function ( Notify ) {

    //Copyright (c) 2009 The Chromium Authors. All rights reserved.
    //Use of this source code is governed by a BSD-style license that can be
    //found in the LICENSE file.

    // Various functions for helping debug WebGL apps.

    var WebGLDebugUtils = function () {

        /**
         * Which arguements are enums.
         * @type {!Object.<number, string>}
         */
        var glValidEnumContexts = {

            // Generic setters and getters

            'enable': {
                0: true
            },
            'disable': {
                0: true
            },
            'getParameter': {
                0: true
            },

            // Rendering

            'drawArrays': {
                0: true
            },
            'drawElements': {
                0: true,
                2: true
            },

            // Shaders

            'createShader': {
                0: true
            },
            'getShaderParameter': {
                1: true
            },
            'getProgramParameter': {
                1: true
            },

            // Vertex attributes

            'getVertexAttrib': {
                1: true
            },
            'vertexAttribPointer': {
                2: true
            },

            // Textures

            'bindTexture': {
                0: true
            },
            'activeTexture': {
                0: true
            },
            'getTexParameter': {
                0: true,
                1: true
            },
            'texParameterf': {
                0: true,
                1: true
            },
            'texParameteri': {
                0: true,
                1: true,
                2: true
            },
            'texImage2D': {
                0: true,
                2: true,
                6: true,
                7: true
            },
            'texSubImage2D': {
                0: true,
                6: true,
                7: true
            },
            'copyTexImage2D': {
                0: true,
                2: true
            },
            'copyTexSubImage2D': {
                0: true
            },
            'generateMipmap': {
                0: true
            },

            // Buffer objects

            'bindBuffer': {
                0: true
            },
            'bufferData': {
                0: true,
                2: true
            },
            'bufferSubData': {
                0: true
            },
            'getBufferParameter': {
                0: true,
                1: true
            },

            // Renderbuffers and framebuffers

            'pixelStorei': {
                0: true,
                1: true
            },
            'readPixels': {
                4: true,
                5: true
            },
            'bindRenderbuffer': {
                0: true
            },
            'bindFramebuffer': {
                0: true
            },
            'checkFramebufferStatus': {
                0: true
            },
            'framebufferRenderbuffer': {
                0: true,
                1: true,
                2: true
            },
            'framebufferTexture2D': {
                0: true,
                1: true,
                2: true
            },
            'getFramebufferAttachmentParameter': {
                0: true,
                1: true,
                2: true
            },
            'getRenderbufferParameter': {
                0: true,
                1: true
            },
            'renderbufferStorage': {
                0: true,
                1: true
            },

            // Frame buffer operations (clear, blend, depth test, stencil)

            'clear': {
                0: true
            },
            'depthFunc': {
                0: true
            },
            'blendFunc': {
                0: true,
                1: true
            },
            'blendFuncSeparate': {
                0: true,
                1: true,
                2: true,
                3: true
            },
            'blendEquation': {
                0: true
            },
            'blendEquationSeparate': {
                0: true,
                1: true
            },
            'stencilFunc': {
                0: true
            },
            'stencilFuncSeparate': {
                0: true,
                1: true
            },
            'stencilMaskSeparate': {
                0: true
            },
            'stencilOp': {
                0: true,
                1: true,
                2: true
            },
            'stencilOpSeparate': {
                0: true,
                1: true,
                2: true,
                3: true
            },

            // Culling

            'cullFace': {
                0: true
            },
            'frontFace': {
                0: true
            }
        };

        /**
         * Map of numbers to names.
         * @type {Object}
         */
        var glEnums = null;

        /**
         * Initializes this module. Safe to call more than once.
         * @param {!WebGLRenderingContext} ctx A WebGL context. If
         *    you have more than one context it doesn't matter which one
         *    you pass in, it is only used to pull out constants.
         */
        function init( ctx ) {
            if ( glEnums === null ) {
                glEnums = {};
                for ( var propertyName in ctx ) {
                    if ( typeof ctx[ propertyName ] === 'number' ) {
                        glEnums[ ctx[ propertyName ] ] = propertyName;
                    }
                }
            }
        }

        /**
         * Checks the utils have been initialized.
         */
        function checkInit() {
            if ( glEnums === null ) {
                throw 'WebGLDebugUtils.init(ctx) not called';
            }
        }

        /**
         * Returns true or false if value matches any WebGL enum
         * @param {*} value Value to check if it might be an enum.
         * @return {boolean} True if value matches one of the WebGL defined enums
         */
        function mightBeEnum( value ) {
            checkInit();
            return ( glEnums[ value ] !== undefined );
        }

        /**
         * Gets an string version of an WebGL enum.
         *
         * Example:
         *   var str = WebGLDebugUtil.glEnumToString(ctx.getError());
         *
         * @param {number} value Value to return an enum for
         * @return {string} The string version of the enum.
         */
        function glEnumToString( value ) {
            checkInit();
            var name = glEnums[ value ];
            return ( name !== undefined ) ? name :
                ( '*UNKNOWN WebGL ENUM (0x' + value.toString( 16 ) + ')' );
        }

        /**
         * Returns the string version of a WebGL argument.
         * Attempts to convert enum arguments to strings.
         * @param {string} functionName the name of the WebGL function.
         * @param {number} argumentIndx the index of the argument.
         * @param {*} value The value of the argument.
         * @return {string} The value as a string.
         */
        function glFunctionArgToString( functionName, argumentIndex, value ) {
            var funcInfo = glValidEnumContexts[ functionName ];
            if ( funcInfo !== undefined ) {
                if ( funcInfo[ argumentIndex ] ) {
                    return glEnumToString( value );
                }
            }
            return value.toString();
        }

        function makePropertyWrapper( wrapper, original, propertyName ) {
            //Notify.log("wrap prop: " + propertyName);
            wrapper.__defineGetter__( propertyName, function () {
                return original[ propertyName ];
            } );
            // TODO(gmane): this needs to handle properties that take more than
            // one value?
            wrapper.__defineSetter__( propertyName, function ( value ) {
                //Notify.log("set: " + propertyName);
                original[ propertyName ] = value;
            } );
        }

        // Makes a function that calls a function on another object.
        function makeFunctionWrapper( original, functionName ) {
            //Notify.log("wrap fn: " + functionName);
            var f = original[ functionName ];
            return function () {
                //Notify.log("call: " + functionName);
                var result = f.apply( original, arguments );
                return result;
            };
        }

        /**
         * Given a WebGL context returns a wrapped context that calls
         * gl.getError after every command and calls a function if the
         * result is not gl.NO_ERROR.
         *
         * @param {!WebGLRenderingContext} ctx The webgl context to
         *        wrap.
         * @param {!function(err, funcName, args): void} opt_onErrorFunc
         *        The function to call when gl.getError returns an
         *        error. If not specified the default function calls
         *        Notify.log with a message.
         */
        function makeDebugContext( ctx, opt_onErrorFunc ) {
            init( ctx );
            opt_onErrorFunc = opt_onErrorFunc || function ( err, functionName, args ) {
                // apparently we can't do args.join(",");
                var argStr = "";
                for ( var ii = 0; ii < args.length; ++ii ) {
                    argStr += ( ( ii === 0 ) ? '' : ', ' ) +
                        glFunctionArgToString( functionName, ii, args[ ii ] );
                }
                Notify.log( "WebGL error " + glEnumToString( err ) + " in " + functionName +
                    "(" + argStr + ")" );
            };

            // Holds booleans for each GL error so after we get the error ourselves
            // we can still return it to the client app.
            var glErrorShadow = {};

            // Makes a function that calls a WebGL function and then calls getError.
            function makeErrorWrapper( ctx, functionName ) {
                return function () {
                    var result = ctx[ functionName ].apply( ctx, arguments );
                    var err = ctx.getError();
                    if ( err !== 0 ) {
                        glErrorShadow[ err ] = true;
                        opt_onErrorFunc( err, functionName, arguments );
                    }
                    return result;
                };
            }

            // Make a an object that has a copy of every property of the WebGL context
            // but wraps all functions.
            var wrapper = {};
            for ( var propertyName in ctx ) {
                if ( typeof ctx[ propertyName ] == 'function' ) {
                    wrapper[ propertyName ] = makeErrorWrapper( ctx, propertyName );
                } else {
                    makePropertyWrapper( wrapper, ctx, propertyName );
                }
            }

            // Override the getError function with one that returns our saved results.
            wrapper.getError = function () {
                for ( var err in glErrorShadow ) {
                    if ( glErrorShadow[ err ] ) {
                        glErrorShadow[ err ] = false;
                        return err;
                    }
                }
                return ctx.NO_ERROR;
            };

            return wrapper;
        }

        function resetToInitialState( ctx ) {
            var numAttribs = ctx.getParameter( ctx.MAX_VERTEX_ATTRIBS );
            var tmp = ctx.createBuffer();
            ctx.bindBuffer( ctx.ARRAY_BUFFER, tmp );
            var ii;
            for ( ii = 0; ii < numAttribs; ++ii ) {
                ctx.disableVertexAttribArray( ii );
                ctx.vertexAttribPointer( ii, 4, ctx.FLOAT, false, 0, 0 );
                ctx.vertexAttrib1f( ii, 0 );
            }
            ctx.deleteBuffer( tmp );

            var numTextureUnits = ctx.getParameter( ctx.MAX_TEXTURE_IMAGE_UNITS );
            for ( ii = 0; ii < numTextureUnits; ++ii ) {
                ctx.activeTexture( ctx.TEXTURE0 + ii );
                ctx.bindTexture( ctx.TEXTURE_CUBE_MAP, null );
                ctx.bindTexture( ctx.TEXTURE_2D, null );
            }

            ctx.activeTexture( ctx.TEXTURE0 );
            ctx.useProgram( null );
            ctx.bindBuffer( ctx.ARRAY_BUFFER, null );
            ctx.bindBuffer( ctx.ELEMENT_ARRAY_BUFFER, null );
            ctx.bindFramebuffer( ctx.FRAMEBUFFER, null );
            ctx.bindRenderbuffer( ctx.RENDERBUFFER, null );
            ctx.disable( ctx.BLEND );
            ctx.disable( ctx.CULL_FACE );
            ctx.disable( ctx.DEPTH_TEST );
            ctx.disable( ctx.DITHER );
            ctx.disable( ctx.SCISSOR_TEST );
            ctx.blendColor( 0, 0, 0, 0 );
            ctx.blendEquation( ctx.FUNC_ADD );
            ctx.blendFunc( ctx.ONE, ctx.ZERO );
            ctx.clearColor( 0, 0, 0, 0 );
            ctx.clearDepth( 1 );
            ctx.clearStencil( -1 );
            ctx.colorMask( true, true, true, true );
            ctx.cullFace( ctx.BACK );
            ctx.depthFunc( ctx.LESS );
            ctx.depthMask( true );
            ctx.depthRange( 0, 1 );
            ctx.frontFace( ctx.CCW );
            ctx.hint( ctx.GENERATE_MIPMAP_HINT, ctx.DONT_CARE );
            ctx.lineWidth( 1 );
            ctx.pixelStorei( ctx.PACK_ALIGNMENT, 4 );
            ctx.pixelStorei( ctx.UNPACK_ALIGNMENT, 4 );
            ctx.pixelStorei( ctx.UNPACK_FLIP_Y_WEBGL, false );
            ctx.pixelStorei( ctx.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false );
            // TODO: Delete this IF.
            if ( ctx.UNPACK_COLORSPACE_CONVERSION_WEBGL ) {
                ctx.pixelStorei( ctx.UNPACK_COLORSPACE_CONVERSION_WEBGL, ctx.BROWSER_DEFAULT_WEBGL );
            }
            ctx.polygonOffset( 0, 0 );
            ctx.sampleCoverage( 1, false );
            ctx.scissor( 0, 0, ctx.canvas.width, ctx.canvas.height );
            ctx.stencilFunc( ctx.ALWAYS, 0, 0xFFFFFFFF );
            ctx.stencilMask( 0xFFFFFFFF );
            ctx.stencilOp( ctx.KEEP, ctx.KEEP, ctx.KEEP );
            ctx.viewport( 0, 0, ctx.canvas.width, ctx.canvas.height );
            ctx.clear( ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT | ctx.STENCIL_BUFFER_BIT );

            // TODO: This should NOT be needed but Firefox fails with 'hint'
            while ( ctx.getError() ) {}
        }

        function makeLostContextSimulatingCanvas( canvas ) {
            var unwrappedContext_;
            //var wrappedContext_;
            var onLost_ = [];
            var onRestored_ = [];
            var wrappedContext_ = {};
            var contextId_ = 1;
            var contextLost_ = false;
            var resourceId_ = 0;
            var resourceDb_ = [];
            var numCallsToLoseContext_ = 0;
            var numCalls_ = 0;
            var canRestore_ = false;
            var restoreTimeout_ = 0;

            // Holds booleans for each GL error so can simulate errors.
            var glErrorShadow_ = {};

            canvas.getContext = function ( f ) {
                return function () {
                    var ctx = f.apply( canvas, arguments );
                    // Did we get a context and is it a WebGL context?
                    if ( ctx instanceof WebGLRenderingContext ) {
                        if ( ctx != unwrappedContext_ ) {
                            if ( unwrappedContext_ ) {
                                throw "got different context";
                            }
                            unwrappedContext_ = ctx;
                            wrappedContext_ = makeLostContextSimulatingContext( unwrappedContext_ );
                        }
                        return wrappedContext_;
                    }
                    return ctx;
                };
            }( canvas.getContext );

            function wrapEvent( listener ) {
                if ( typeof ( listener ) == "function" ) {
                    return listener;
                } else {
                    return function ( info ) {
                        listener.handleEvent( info );
                    };
                }
            }

            var addOnContextLostListener = function ( listener ) {
                onLost_.push( wrapEvent( listener ) );
            };

            var addOnContextRestoredListener = function ( listener ) {
                onRestored_.push( wrapEvent( listener ) );
            };


            function wrapAddEventListener( canvas ) {
                var f = canvas.addEventListener;
                canvas.addEventListener = function ( type, listener, bubble ) {
                    switch ( type ) {
                    case 'webglcontextlost':
                        addOnContextLostListener( listener );
                        break;
                    case 'webglcontextrestored':
                        addOnContextRestoredListener( listener );
                        break;
                    default:
                        f.apply( canvas, arguments );
                    }
                };
            }

            wrapAddEventListener( canvas );

            canvas.loseContext = function () {
                if ( !contextLost_ ) {
                    contextLost_ = true;
                    numCallsToLoseContext_ = 0;
                    ++contextId_;
                    while ( unwrappedContext_.getError() ) {}
                    clearErrors();
                    glErrorShadow_[ unwrappedContext_.CONTEXT_LOST_WEBGL ] = true;
                    var event = makeWebGLContextEvent( "context lost" );
                    var callbacks = onLost_.slice();
                    setTimeout( function () {
                        //Notify.log("numCallbacks:" + callbacks.length);
                        for ( var ii = 0; ii < callbacks.length; ++ii ) {
                            //Notify.log("calling callback:" + ii);
                            callbacks[ ii ]( event );
                        }
                        if ( restoreTimeout_ >= 0 ) {
                            setTimeout( function () {
                                canvas.restoreContext();
                            }, restoreTimeout_ );
                        }
                    }, 0 );
                }
            };

            canvas.restoreContext = function () {
                if ( contextLost_ ) {
                    if ( onRestored_.length ) {
                        setTimeout( function () {
                            if ( !canRestore_ ) {
                                throw "can not restore. webglcontestlost listener did not call event.preventDefault";
                            }
                            freeResources();
                            resetToInitialState( unwrappedContext_ );
                            contextLost_ = false;
                            numCalls_ = 0;
                            canRestore_ = false;
                            var callbacks = onRestored_.slice();
                            var event = makeWebGLContextEvent( "context restored" );
                            for ( var ii = 0; ii < callbacks.length; ++ii ) {
                                callbacks[ ii ]( event );
                            }
                        }, 0 );
                    }
                }
            };

            canvas.loseContextInNCalls = function ( numCalls ) {
                if ( contextLost_ ) {
                    throw "You can not ask a lost contet to be lost";
                }
                numCallsToLoseContext_ = numCalls_ + numCalls;
            };

            canvas.getNumCalls = function () {
                return numCalls_;
            };

            canvas.setRestoreTimeout = function ( timeout ) {
                restoreTimeout_ = timeout;
            };

            function isWebGLObject( obj ) {
                //return false;
                return ( obj instanceof WebGLBuffer ||
                    obj instanceof WebGLFramebuffer ||
                    obj instanceof WebGLProgram ||
                    obj instanceof WebGLRenderbuffer ||
                    obj instanceof WebGLShader ||
                    obj instanceof WebGLTexture );
            }

            function checkResources( args ) {
                for ( var ii = 0; ii < args.length; ++ii ) {
                    var arg = args[ ii ];
                    if ( isWebGLObject( arg ) ) {
                        return arg.__webglDebugContextLostId__ == contextId_;
                    }
                }
                return true;
            }

            function clearErrors() {
                var k = Object.keys( glErrorShadow_ );
                for ( var ii = 0; ii < k.length; ++ii ) {
                    delete glErrorShadow_[ k ];
                }
            }

            function loseContextIfTime() {
                ++numCalls_;
                if ( !contextLost_ ) {
                    if ( numCallsToLoseContext_ == numCalls_ ) {
                        canvas.loseContext();
                    }
                }
            }

            // Makes a function that simulates WebGL when out of context.
            function makeLostContextFunctionWrapper( ctx, functionName ) {
                var f = ctx[ functionName ];
                return function () {
                    // Notify.log("calling:" + functionName);
                    // Only call the functions if the context is not lost.
                    loseContextIfTime();
                    if ( !contextLost_ ) {
                        //if (!checkResources(arguments)) {
                        //  glErrorShadow_[wrappedContext_.INVALID_OPERATION] = true;
                        //  return;
                        //}
                        var result = f.apply( ctx, arguments );
                        return result;
                    }
                };
            }

            function freeResources() {
                for ( var ii = 0; ii < resourceDb_.length; ++ii ) {
                    var resource = resourceDb_[ ii ];
                    if ( resource instanceof WebGLBuffer ) {
                        unwrappedContext_.deleteBuffer( resource );
                    } else if ( resource instanceof WebGLFramebuffer ) {
                        unwrappedContext_.deleteFramebuffer( resource );
                    } else if ( resource instanceof WebGLProgram ) {
                        unwrappedContext_.deleteProgram( resource );
                    } else if ( resource instanceof WebGLRenderbuffer ) {
                        unwrappedContext_.deleteRenderbuffer( resource );
                    } else if ( resource instanceof WebGLShader ) {
                        unwrappedContext_.deleteShader( resource );
                    } else if ( resource instanceof WebGLTexture ) {
                        unwrappedContext_.deleteTexture( resource );
                    }
                }
            }

            function makeWebGLContextEvent( statusMessage ) {
                return {
                    statusMessage: statusMessage,
                    preventDefault: function () {
                        canRestore_ = true;
                    }
                };
            }


            function makeLostContextSimulatingContext( ctx ) {
                // copy all functions and properties to wrapper
                for ( var propertyName in ctx ) {
                    if ( typeof ctx[ propertyName ] == 'function' ) {
                        wrappedContext_[ propertyName ] = makeLostContextFunctionWrapper(
                            ctx, propertyName );
                    } else {
                        makePropertyWrapper( wrappedContext_, ctx, propertyName );
                    }
                }

                // Wrap a few functions specially.
                wrappedContext_.getError = function () {
                    loseContextIfTime();
                    var err;
                    if ( !contextLost_ ) {
                        while ( err = unwrappedContext_.getError() ) {
                            glErrorShadow_[ err ] = true;
                        }
                    }
                    for ( err in glErrorShadow_ ) {
                        if ( glErrorShadow_[ err ] ) {
                            delete glErrorShadow_[ err ];
                            return err;
                        }
                    }
                    return wrappedContext_.NO_ERROR;
                };

                var creationFunctions = [
                    "createBuffer",
                    "createFramebuffer",
                    "createProgram",
                    "createRenderbuffer",
                    "createShader",
                    "createTexture"
                ];
                var functionName, ii;
                for ( ii = 0; ii < creationFunctions.length; ++ii ) {
                    functionName = creationFunctions[ ii ];
                    wrappedContext_[ functionName ] = function ( f ) {
                        return function () {
                            loseContextIfTime();
                            if ( contextLost_ ) {
                                return null;
                            }
                            var obj = f.apply( ctx, arguments );
                            obj.__webglDebugContextLostId__ = contextId_;
                            resourceDb_.push( obj );
                            return obj;
                        };
                    }( ctx[ functionName ] );
                }

                var functionsThatShouldReturnNull = [
                    "getActiveAttrib",
                    "getActiveUniform",
                    "getBufferParameter",
                    "getContextAttributes",
                    "getAttachedShaders",
                    "getFramebufferAttachmentParameter",
                    "getParameter",
                    "getProgramParameter",
                    "getProgramInfoLog",
                    "getRenderbufferParameter",
                    "getShaderParameter",
                    "getShaderInfoLog",
                    "getShaderSource",
                    "getTexParameter",
                    "getUniform",
                    "getUniformLocation",
                    "getVertexAttrib"
                ];
                for ( ii = 0; ii < functionsThatShouldReturnNull.length; ++ii ) {
                    functionName = functionsThatShouldReturnNull[ ii ];
                    wrappedContext_[ functionName ] = function ( f ) {
                        return function () {
                            loseContextIfTime();
                            if ( contextLost_ ) {
                                return null;
                            }
                            return f.apply( ctx, arguments );
                        };
                    }( wrappedContext_[ functionName ] );
                }

                var isFunctions = [
                    "isBuffer",
                    "isEnabled",
                    "isFramebuffer",
                    "isProgram",
                    "isRenderbuffer",
                    "isShader",
                    "isTexture"
                ];
                for ( ii = 0; ii < isFunctions.length; ++ii ) {
                    functionName = isFunctions[ ii ];
                    wrappedContext_[ functionName ] = function ( f ) {
                        return function () {
                            loseContextIfTime();
                            if ( contextLost_ ) {
                                return false;
                            }
                            return f.apply( ctx, arguments );
                        };
                    }( wrappedContext_[ functionName ] );
                }

                wrappedContext_.checkFramebufferStatus = function ( f ) {
                    return function () {
                        loseContextIfTime();
                        if ( contextLost_ ) {
                            return wrappedContext_.FRAMEBUFFER_UNSUPPORTED;
                        }
                        return f.apply( ctx, arguments );
                    };
                }( wrappedContext_.checkFramebufferStatus );

                wrappedContext_.getAttribLocation = function ( f ) {
                    return function () {
                        loseContextIfTime();
                        if ( contextLost_ ) {
                            return -1;
                        }
                        return f.apply( ctx, arguments );
                    };
                }( wrappedContext_.getAttribLocation );

                wrappedContext_.getVertexAttribOffset = function ( f ) {
                    return function () {
                        loseContextIfTime();
                        if ( contextLost_ ) {
                            return 0;
                        }
                        return f.apply( ctx, arguments );
                    };
                }( wrappedContext_.getVertexAttribOffset );

                wrappedContext_.isContextLost = function () {
                    return contextLost_;
                };

                return wrappedContext_;
            }

            // TODO: find why this is there ?
            return canvas;
        }

        return {
            /**
     * Initializes this module. Safe to call more than once.
     * @param {!WebGLRenderingContext} ctx A WebGL context. If
    }
   *    you have more than one context it doesn't matter which one
   *    you pass in, it is only used to pull out constants.
   */
            'init': init,

            /**
             * Returns true or false if value matches any WebGL enum
             * @param {*} value Value to check if it might be an enum.
             * @return {boolean} True if value matches one of the WebGL defined enums
             */
            'mightBeEnum': mightBeEnum,

            /**
             * Gets an string version of an WebGL enum.
             *
             * Example:
             *   WebGLDebugUtil.init(ctx);
             *   var str = WebGLDebugUtil.glEnumToString(ctx.getError());
             *
             * @param {number} value Value to return an enum for
             * @return {string} The string version of the enum.
             */
            'glEnumToString': glEnumToString,

            /**
             * Converts the argument of a WebGL function to a string.
             * Attempts to convert enum arguments to strings.
             *
             * Example:
             *   WebGLDebugUtil.init(ctx);
             *   var str = WebGLDebugUtil.glFunctionArgToString('bindTexture', 0, gl.TEXTURE_2D);
             *
             * would return 'TEXTURE_2D'
             *
             * @param {string} functionName the name of the WebGL function.
             * @param {number} argumentIndx the index of the argument.
             * @param {*} value The value of the argument.
             * @return {string} The value as a string.
             */
            'glFunctionArgToString': glFunctionArgToString,

            /**
             * Given a WebGL context returns a wrapped context that calls
             * gl.getError after every command and calls a function if the
             * result is not NO_ERROR.
             *
             * You can supply your own function if you want. For example, if you'd like
             * an exception thrown on any GL error you could do this
             *
             *    function throwOnGLError(err, funcName, args) {
             *      throw WebGLDebugUtils.glEnumToString(err) + " was caused by call to" +
             *            funcName;
             *    };
             *
             *    ctx = WebGLDebugUtils.makeDebugContext(
             *        canvas.getContext("webgl"), throwOnGLError);
             *
             * @param {!WebGLRenderingContext} ctx The webgl context to wrap.
             * @param {!function(err, funcName, args): void} opt_onErrorFunc The function
             *     to call when gl.getError returns an error. If not specified the default
             *     function calls Notify.log with a message.
             */
            'makeDebugContext': makeDebugContext,

            /**
             * Given a canvas element returns a wrapped canvas element that will
             * simulate lost context. The canvas returned adds the following functions.
             *
             * loseContext:
             *   simulates a lost context event.
             *
             * restoreContext:
             *   simulates the context being restored.
             *
             * lostContextInNCalls:
             *   loses the context after N gl calls.
             *
             * getNumCalls:
             *   tells you how many gl calls there have been so far.
             *
             * setRestoreTimeout:
             *   sets the number of milliseconds until the context is restored
             *   after it has been lost. Defaults to 0. Pass -1 to prevent
             *   automatic restoring.
             *
             * @param {!Canvas} canvas The canvas element to wrap.
             */
            'makeLostContextSimulatingCanvas': makeLostContextSimulatingCanvas,

            /**
             * Resets a context to the initial state.
             * @param {!WebGLRenderingContext} ctx The webgl context to
             *     reset.
             */
            'resetToInitialState': resetToInitialState
        };

    }();

    return WebGLDebugUtils;
} );

/* jshint ignore:end */
;
define( 'osgViewer/stats',[
    'osg/Utils'
], function ( MACROUTILS ) {

    var Stats = {};

    Stats.Stats = function ( canvas, textCanvas ) {
        this.layers = [];
        this.lastUpdate = undefined;
        this.canvas = canvas;
        this.textCanvas = textCanvas;
        this.numberUpdate = 0;
    };

    Stats.Stats.prototype = {
        addLayer: function ( color, maxVal, getter, texter ) {
            if ( color === undefined ) {
                color = 'rgb(255,255,255)';
            }
            this.layers.push( {
                previous: 0,
                color: color,
                getValue: getter,
                getText: texter,
                average: 0,
                max: maxVal
            } );
        },

        update: function () {

            var delta, i, l, layer, value, c, ctx, height, myImageData, t = MACROUTILS.performance.now();
            if ( this.lastUpdate === undefined ) {
                this.lastUpdate = t;
            }
            this.numberUpdate++;
            for ( i = 0, l = this.layers.length; i < l; i++ ) {
                layer = this.layers[ i ];
                value = layer.getValue( t );
                layer.average += value;
            }
            //i = 2.0 * 60.0 / 1000.0;
            i = 0.12; //4.0 * 60.0 / 1000.0;
            delta = ( t - this.lastUpdate ) * i;
            if ( delta >= 1.0 ) {

                t -= ( delta - Math.floor( delta ) ) / i;
                delta = Math.floor( delta );

                c = this.canvas;
                ctx = c.getContext( '2d' );

                myImageData = ctx.getImageData( delta, 0, c.width - delta, c.height );
                ctx.putImageData( myImageData, 0, 0 );
                ctx.clearRect( c.width - delta, 0, delta, c.height );

                for ( i = 0, l = this.layers.length; i < l; i++ ) {
                    layer = this.layers[ i ];
                    value = layer.getValue( t );
                    value *= c.height / layer.max;
                    if ( value > c.height ) value = c.height;
                    ctx.lineWidth = 1.0;
                    ctx.strokeStyle = layer.color;
                    ctx.beginPath();
                    ctx.moveTo( c.width - delta, c.height - layer.previous );
                    ctx.lineTo( c.width, c.height - value );
                    ctx.stroke();
                    layer.previous = value;
                }
            }

            if ( this.numberUpdate % 60 === 0 ) {
                c = this.textCanvas;
                ctx = c.getContext( '2d' );
                ctx.font = '14px Sans';
                height = 17;
                delta = height;
                ctx.clearRect( 0, 0, c.width, c.height );
                for ( i = 0, l = this.layers.length; i < l; i++ ) {
                    layer = this.layers[ i ];
                    value = layer.getText( layer.average / this.numberUpdate );
                    layer.average = 0;
                    ctx.fillStyle = layer.color;
                    ctx.fillText( value, 0, delta );
                    delta += height;
                }
                this.numberUpdate = 0;
            }
            this.lastUpdate = t;
        }
    };

    return Stats;
} );

define( 'osgViewer/Viewer',[
    'osg/Notify',
    'osg/Utils',
    'osg/UpdateVisitor',
    'osg/CullVisitor',
    'osgUtil/osgUtil',
    'osgViewer/View',
    'osg/RenderStage',
    'osg/StateGraph',
    'osg/Matrix',
    'osg/State',
    'osgGA/OrbitManipulator',
    'osgViewer/eventProxy/EventProxy',
    'osgViewer/webgl-utils',
    'osgViewer/webgl-debug',
    'osgViewer/stats'
], function ( Notify, MACROUTILS, UpdateVisitor, CullVisitor, osgUtil, View, RenderStage, StateGraph, Matrix, State, OrbitManipulator, EventProxy, WebGLUtils, WebGLDebugUtils, Stats ) {


    var OptionsDefault = {
        'antialias': true,
        'useDevicePixelRatio': true
    };


    var Options = function( defaults ) {

        Object.keys( defaults ).forEach( function ( key ) {
            this[ key ] = defaults[ key ];
        }.bind( this ) );

    };

    Options.prototype = {
        get: function( key ) {
            return this[key];
        },
        getBoolean: function ( key ) {
            var val = this.getString( key );
            if ( val ) return Boolean( JSON.parse(val) );
            return undefined;
        },

        getNumber: function ( key ) {
            var val = this[ key ];
            if ( val ) return Number( JSON.parse(val));
            return undefined;
        },

        getString: function ( key ) {
            var val = this[ key ];
            if ( val ) return this[ key ].toString();
            return undefined;
        }

    };

    var OptionsURL = ( function () {
        var options = {};
        ( function ( options ) {
            var vars = [],
                hash;
            var indexOptions = window.location.href.indexOf( '?' );
            if ( indexOptions < 0 ) return;

            var hashes = window.location.href.slice( indexOptions + 1 ).split( '&' );
            for ( var i = 0; i < hashes.length; i++ ) {
                hash = hashes[ i ].split( '=' );
                var element = hash[ 0 ];
                vars.push( element );
                var result = hash[ 1 ];
                if ( result === undefined ) {
                    result = '1';
                }
                options[ element ] = result;
            }
        } )( options );

        if ( options.log !== undefined ) {
            var level = options.log.toLowerCase();

            switch ( level ) {
            case 'debug':
                Notify.setNotifyLevel( Notify.DEBUG );
                break;
            case 'info':
                Notify.setNotifyLevel( Notify.INFO );
                break;
            case 'notice':
                Notify.setNotifyLevel( Notify.NOTICE );
                break;
            case 'warn':
                Notify.setNotifyLevel( Notify.WARN );
                break;
            case 'error':
                Notify.setNotifyLevel( Notify.ERROR );
                break;
            case 'html':
                ( function () {
                    var logContent = [];
                    var divLogger = document.createElement( 'div' );
                    var codeElement = document.createElement( 'pre' );
                    document.addEventListener( 'DOMContentLoaded', function () {
                        document.body.appendChild( divLogger );
                        divLogger.appendChild( codeElement );
                    } );
                    var logFunc = function ( str ) {
                        logContent.unshift( str );
                        codeElement.innerHTML = logContent.join( '\n' );
                    };
                    divLogger.style.overflow = 'hidden';
                    divLogger.style.position = 'absolute';
                    divLogger.style.zIndex = '10000';
                    divLogger.style.height = '100%';
                    divLogger.style.maxWidth = '600px';
                    codeElement.style.overflow = 'scroll';
                    codeElement.style.width = '105%';
                    codeElement.style.height = '100%';
                    codeElement.style.fontSize = '10px';

                    [ 'log', 'error', 'warn', 'info', 'debug' ].forEach( function ( value ) {
                        window.console[ value ] = logFunc;
                    } );
                } )();
                break;
            }
        }

        return options;
    } )();

    var Viewer = function ( canvas, userOptions, error ) {
        View.call( this );

        // use default options
        var options = new Options( OptionsDefault );
        if ( userOptions ) {
            // user options override by user options
            MACROUTILS.objectMix( options, userOptions );
        }
        // if url options override url options
        MACROUTILS.objectMix( options, OptionsURL );

        this._options = options;

        // #FIXME see tojiro's blog for webgl lost context stuffs
        if ( options.get( 'SimulateWebGLLostContext') ) {
            canvas = WebGLDebugUtils.makeLostContextSimulatingCanvas( canvas );
            canvas.loseContextInNCalls( options.get( 'SimulateWebGLLostContext' ) );
        }

        var gl = WebGLUtils.setupWebGL( canvas, options, error );
        var self = this;
        canvas.addEventListener( 'webglcontextlost', function ( event ) {
            self.contextLost();
            event.preventDefault();
        }, false );

        canvas.addEventListener( 'webglcontextrestored', function () {
            self.contextRestored();
        }, false );


        if ( Notify.reportWebGLError || options.get( 'reportWebGLError') ) {
            gl = WebGLDebugUtils.makeDebugContext( gl );
        }


        if ( gl ) {
            this.setGraphicContext( gl );
            this.initWebGLCaps( gl );


            MACROUTILS.init();
            this._canvas = canvas;
            this._frameRate = 60.0;
            osgUtil.UpdateVisitor = UpdateVisitor;
            osgUtil.CullVisitor = CullVisitor;

            // default argument for mouse binding
            var defaultMouseEventNode = options.mouseEventNode || canvas;

            var eventsBackend = options.EventBackend || {};
            if ( !options.EventBackend )  options.EventBackend = eventsBackend;
            eventsBackend.StandardMouseKeyboard = options.EventBackend.StandardMouseKeyboard || {};
            var mouseEventNode = eventsBackend.StandardMouseKeyboard.mouseEventNode || defaultMouseEventNode;
            eventsBackend.StandardMouseKeyboard.mouseEventNode = mouseEventNode;
            eventsBackend.StandardMouseKeyboard.keyboardEventNode = eventsBackend.StandardMouseKeyboard.keyboardEventNode || document;

            // hammer
            eventsBackend.Hammer = eventsBackend.Hammer || {};
            eventsBackend.Hammer.eventNode = eventsBackend.Hammer.eventNode || defaultMouseEventNode;

            // gamepade
            eventsBackend.GamePad = eventsBackend.GamePad || {};

            this.setUpView( canvas );
        } else {
            throw 'No WebGL implementation found';
        }
    };


    Viewer.prototype = MACROUTILS.objectInehrit( View.prototype, {

        contextLost: function () {
            Notify.log( 'webgl context lost' );
            window.cancelRequestAnimFrame( this._requestID );
        },
        contextRestored: function () {
            Notify.log( 'webgl context restored, but not supported - reload the page' );
        },

        init: function () {
            this._done = false;
            this._state = new State();

            var gl = this.getGraphicContext();
            this._state.setGraphicContext( gl );
            gl.pixelStorei( gl.UNPACK_FLIP_Y_WEBGL, true );

            this._updateVisitor = new osgUtil.UpdateVisitor();
            this._cullVisitor = new osgUtil.CullVisitor();

            this._renderStage = new RenderStage();
            this._stateGraph = new StateGraph();

            this.parseOptions();

            this.getCamera().setClearColor( [ 0.0, 0.0, 0.0, 0.0 ] );
            this._eventProxy = this.initEventProxy( this._options );
        },
        getState: function () {
            // would have more sense to be in view
            // but I would need to put cull and draw on lower Object
            // in View or a new Renderer object
            return this._state;
        },

        parseOptions: function () {

            if ( this._options.stats ) {
                this.initStats( this._options );
            }

        },

        initStats: function ( options ) {

            var maxMS = 35;
            var stepMS = 5;
            //var fontsize = 14;

            if ( options.statsMaxMS !== undefined ) {
                maxMS = parseInt( options.statsMaxMS, 10 );
            }
            if ( options.statsStepMS !== undefined ) {
                stepMS = parseInt( options.statsStepMS, 10 );
            }

            var createDomElements = function ( elementToAppend ) {
                var dom = [
                    '<div id="StatsDiv" style="top: 0; position: absolute; width: 300px; height: 150px; z-index: 10;">',

                    '<div id="StatsCanvasDiv" style="position: relative;">',
                    '<canvas id="StatsCanvasGrid" width="300" height="150" style="z-index:-1; position: absolute; background: rgba(14,14,14,0.8); " ></canvas>',
                    '<canvas id="StatsCanvas" width="300" height="150" style="z-index:8; position: absolute;" ></canvas>',
                    '<canvas id="StatsCanvasText" width="300" height="150" style="z-index:9; position: absolute;" ></canvas>',
                    '</div>',

                    '</div>'
                ].join( '\n' );
                var parent;
                if ( elementToAppend === undefined ) {
                    parent = document.body;
                    //elementToAppend = 'body';
                } else {
                    parent = document.getElementById( elementToAppend );
                }

                //jQuery(dom).appendTo(elementToAppend);
                var mydiv = document.createElement( 'div' );
                mydiv.innerHTML = dom;
                parent.appendChild( mydiv );

                var grid = document.getElementById( 'StatsCanvasGrid' );
                var ctx = grid.getContext( '2d' );
                ctx.clearRect( 0, 0, grid.width, grid.height );

                var step = Math.floor( maxMS / stepMS ).toFixed( 0 );
                var r = grid.height / step;
                ctx.strokeStyle = 'rgb(70,70,70)';
                for ( var i = 0, l = step; i < l; i++ ) {
                    ctx.beginPath();
                    ctx.moveTo( 0, i * r );
                    ctx.lineTo( grid.width, i * r );
                    ctx.stroke();
                }


                return {
                    graph: document.getElementById( 'StatsCanvas' ),
                    text: document.getElementById( 'StatsCanvasText' )
                };
            };

            if ( this._canvasStats === undefined || this._canvasStats === null ) {
                var domStats = createDomElements();
                this._canvasStats = domStats.graph;
                this._canvasStatsText = domStats.text;
            }
            this._stats = new Stats.Stats( this._canvasStats, this._canvasStatsText );
            var that = this;
            this._frameRate = 1;
            this._frameTime = 0;
            this._updateTime = 0;
            this._cullTime = 0;
            this._drawTime = 0;
            this._stats.addLayer( '#ff0fff', 120,
                                  function ( /*t*/ ) {
                                      return ( 1000.0 / that._frameRate );
                                  },
                                  function ( a ) {
                                      return 'FrameRate: ' + ( a ).toFixed( 0 ) + ' fps';
                                  } );

            this._stats.addLayer( '#ffff00', maxMS,
                                  function ( /*t*/ ) {
                                      return that._frameTime;
                                  },
                                  function ( a ) {
                                      return 'FrameTime: ' + a.toFixed( 2 ) + ' ms';
                                  } );

            this._stats.addLayer( '#d07b1f', maxMS,
                                  function ( /*t*/ ) {
                                      return that._updateTime;
                                  },
                                  function ( a ) {
                                      return 'UpdateTime: ' + a.toFixed( 2 ) + ' ms';
                                  } );

            this._stats.addLayer( '#73e0ff', maxMS,
                                  function ( /*t*/ ) {
                                      return that._cullTime;
                                  },
                                  function ( a ) {
                                      return 'CullTime: ' + a.toFixed( 2 ) + ' ms';
                                  } );

            this._stats.addLayer( '#ff0000',
                                  maxMS,
                                  function ( /*t*/ ) {
                                      return that._drawTime;
                                  },
                                  function ( a ) {
                                      return 'DrawTime: ' + a.toFixed( 2 ) + ' ms';
                                  } );

            if ( window.performance && window.performance.memory && window.performance.memory.totalJSHeapSize )
                this._stats.addLayer( '#00ff00',
                                      window.performance.memory.totalJSHeapSize * 2,
                                      function ( /*t*/ ) {
                                          return that._memSize;
                                      },
                                      function ( a ) {
                                          return 'Memory : ' + a.toFixed( 0 ) + ' b';
                                      } );

        },

        update: function () {
            this.getScene().accept( this._updateVisitor );
        },
        cull: function () {
            // this part of code should be called for each view
            // right now, we dont support multi view
            this._stateGraph.clean();
            this._renderStage.reset();

            this._cullVisitor.reset();
            this._cullVisitor.setStateGraph( this._stateGraph );
            this._cullVisitor.setRenderStage( this._renderStage );
            var camera = this.getCamera();
            this._cullVisitor.pushStateSet( camera.getStateSet() );
            this._cullVisitor.pushProjectionMatrix( camera.getProjectionMatrix() );

            // update bound
            camera.getBound();

            var identity = Matrix.create();
            this._cullVisitor.pushModelviewMatrix( identity );

            if ( this._light ) {
                this._cullVisitor.addPositionedAttribute( this._light );
            }

            this._cullVisitor.pushModelviewMatrix( camera.getViewMatrix() );
            this._cullVisitor.pushViewport( camera.getViewport() );
            this._cullVisitor.setCullSettings( camera );

            this._renderStage.setClearDepth( camera.getClearDepth() );
            this._renderStage.setClearColor( camera.getClearColor() );
            this._renderStage.setClearMask( camera.getClearMask() );
            this._renderStage.setViewport( camera.getViewport() );

            //CullVisitor.prototype.handleCullCallbacksAndTraverse.call(this._cullVisitor,camera);
            this.getScene().accept( this._cullVisitor );

            // fix projection matrix if camera has near/far auto compute
            this._cullVisitor.popModelviewMatrix();
            this._cullVisitor.popProjectionMatrix();
            this._cullVisitor.popViewport();
            this._cullVisitor.popStateSet();

            this._renderStage.sort();
        },
        draw: function () {
            var state = this.getState();
            this._renderStage.draw( state );

            // noticed that we accumulate lot of stack, maybe because of the stateGraph
            state.popAllStateSets();
            state.applyWithoutProgram(); //state.apply(); // apply default state (global)
        },

        frame: function () {
            var frameTime, beginFrameTime;
            frameTime = MACROUTILS.performance.now();
            if ( this._lastFrameTime === undefined ) {
                this._lastFrameTime = 0;
            }
            this._frameRate = frameTime - this._lastFrameTime;
            this._lastFrameTime = frameTime;
            beginFrameTime = frameTime;

            var frameStamp = this.getFrameStamp();

            if ( frameStamp.getFrameNumber() === 0 ) {
                frameStamp.setReferenceTime( frameTime / 1000.0 );
                this._numberFrame = 0;
            }

            frameStamp.setSimulationTime( frameTime / 1000.0 - frameStamp.getReferenceTime() );

            // setup framestamp
            this._updateVisitor.setFrameStamp( frameStamp );
            //this._cullVisitor.setFrameStamp(this.getFrameStamp());

            // update inputs devices
            this.updateEventProxy( this._eventProxy, frameStamp );

            // Update Manipulator/Event
            // should be merged with the update of game pad below
            if ( this.getManipulator() ) {
                this.getManipulator().update( this._updateVisitor );
                Matrix.copy( this.getManipulator().getInverseMatrix(), this.getCamera().getViewMatrix() );
            }

            if ( this._stats === undefined ) {
                // time the update
                this.update();
                this.cull();
                this.draw();
                frameStamp.setFrameNumber( frameStamp.getFrameNumber() + 1 );
                this._numberFrame++;
                this._frameTime = MACROUTILS.performance.now() - beginFrameTime;
            } else {
                this._updateTime = MACROUTILS.performance.now();
                this.update();
                this._updateTime = MACROUTILS.performance.now() - this._updateTime;


                this._cullTime = MACROUTILS.performance.now();
                this.cull();
                this._cullTime = MACROUTILS.performance.now() - this._cullTime;

                this._drawTime = MACROUTILS.performance.now();
                this.draw();
                this._drawTime = MACROUTILS.performance.now() - this._drawTime;

                frameStamp.setFrameNumber( frameStamp.getFrameNumber() + 1 );

                this._numberFrame++;
                this._frameTime = MACROUTILS.performance.now() - beginFrameTime;

                if ( window.performance && window.performance.memory && window.performance.memory.usedJSHeapSize )
                    this._memSize = window.performance.memory.usedJSHeapSize;
                this._stats.update();
            }
        },

        setDone: function ( bool ) {
            this._done = bool;
        },
        done: function () {
            return this._done;
        },

        run: function () {
            var self = this;
            var render = function () {
                if ( !self.done() ) {
                    self._requestID = window.requestAnimationFrame( render, self.canvas );
                    self.frame();
                }
            };
            render();
        },

        setupManipulator: function ( manipulator /*, dontBindDefaultEvent */ ) {
            if ( manipulator === undefined ) {
                manipulator = new OrbitManipulator();
            }

            if ( manipulator.setNode !== undefined ) {
                manipulator.setNode( this.getSceneData() );
            } else {
                // for backward compatibility
                manipulator.view = this;
            }

            this.setManipulator( manipulator );

            var resize = function ( /*ev*/ ) {

                var canvas = this._canvas;
                this.computeCanvasSize( canvas );

                var camera = this.getCamera();
                var vp = camera.getViewport();

                var prevWidth = vp.width();
                var prevHeight = vp.height();

                Notify.debug( 'canvas resize ' + prevWidth + 'x' + prevHeight + ' to ' + canvas.width + 'x' + canvas.height );
                var widthChangeRatio = canvas.width / prevWidth;
                var heightChangeRatio = canvas.height / prevHeight;
                var aspectRatioChange = widthChangeRatio / heightChangeRatio;
                vp.setViewport( vp.x() * widthChangeRatio, vp.y() * heightChangeRatio, vp.width() * widthChangeRatio, vp.height() * heightChangeRatio );

                if ( aspectRatioChange !== 1.0 ) {
                    Matrix.preMult( camera.getProjectionMatrix(), Matrix.makeScale( 1.0 / aspectRatioChange, 1.0, 1.0, Matrix.create() ) );
                }
            };
            window.addEventListener( 'resize', resize.bind( this ), true );
        },

        // intialize all input devices
        initEventProxy: function ( argsObject ) {
            var args = argsObject || {};
            var deviceEnabled = {};

            var lists = EventProxy;
            var argumentEventBackend = args.EventBackend;
            // loop on each devices and try to initialize it
            var keys = window.Object.keys( lists );
            for ( var i = 0, l = keys.length; i < l; i++ ) {
                var device = keys[ i ];

                // check if the config has a require
                var initialize = true;
                var argDevice = {};
                if ( argumentEventBackend && ( argumentEventBackend[ device ] !== undefined ) ) {
                    initialize = argumentEventBackend[ device ].enable || true;
                    argDevice = argumentEventBackend[ device ];
                }

                if ( initialize ) {
                    var inputDevice = new lists[ device ]( this );
                    inputDevice.init( argDevice );
                    deviceEnabled[ device ] = inputDevice;
                }
            }
            return deviceEnabled;
        },
        updateEventProxy: function ( list, frameStamp ) {
            var keys = window.Object.keys( list );
            keys.forEach( function ( key ) {
                var device = list[ key ];
                if ( device.update )
                    device.update( frameStamp );
            } );
        }

    } );

    return Viewer;
} );

define( 'osgViewer/osgViewer',[
    'osgViewer/View',
    'osgViewer/Viewer',
    'osgViewer/eventProxy/EventProxy'
], function ( View, Viewer, EventProxy ) {

    var osgViewer = {};

    osgViewer.View = View;
    osgViewer.Viewer = Viewer;
    osgViewer.EventProxy = EventProxy;

    return osgViewer;
} );

define( 'OSG',[
    'osgNameSpace',
    'osg/osg',
    'osgAnimation/osgAnimation',
    'osgDB/osgDB',
    'osgGA/osgGA',
    'osgUtil/osgUtil',
    'osgViewer/osgViewer'
], function ( osgNameSpace, osg, osgAnimation, osgDB, osgGA, osgUtil, osgViewer ) {


    /*jshint unused: true */
    var Q = require('Q');
    /*jshint unused: false */
    var openSceneGraph = osgNameSpace;

    openSceneGraph.osg = osg;
    openSceneGraph.osgAnimation = osgAnimation;
    openSceneGraph.osgDB = osgDB;
    openSceneGraph.osgGA = osgGA;
    openSceneGraph.osgUtil = osgUtil;
    openSceneGraph.osgViewer = osgViewer;

    var namespaces = [ 'osg', 'osgAnimation', 'osgDB', 'osgGA', 'osgUtil', 'osgViewer' ];

    // for backward compatibility
    openSceneGraph.globalify = function () {
        namespaces.forEach( function ( namespace ) {
            window[ namespace ] = openSceneGraph[ namespace ];
        } );
    };

    return openSceneGraph;
} );
    //Register in the values from the outer closure for common dependencies
    //as local almond modules
    define('Q', function () {
        return Q;
    });

    define('Hammer', function () {
        return Hammer;
    });

    define('Leap', function () {
        return Leap;
    });

    //Use almond's special top-level, synchronous require to trigger factory
    //functions, get the final module value, and export it as the public
    //value.
    return require('OSG');
}));
