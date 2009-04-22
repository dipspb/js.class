/**
 * Module is the core class in JS.Class. A module is simply an object that stores methods,
 * and is responsible for handling method lookups, inheritance relationships and the like.
 * All of Ruby's inheritance semantics are handled using modules in JS.Class.
 * 
 * The basic object/module/class model in Ruby is expressed in the diagram at
 * http://ruby-doc.org/core/classes/Class.html -- Class inherits from Module, which
 * inherits from Object (as do all custom classes). Kernel is a Module which is mixed
 * into Object to provide methods common to all objects.
 * 
 * In JS.Class, there is no Object class, but we do have Module, Class and Kernel. All
 * top-level (parentless) classes include the Kernel module, so all classes in effect
 * inherit from Kernel. All classes are instances of Class, and all modules instances of
 * Module. Module is a top-level class, from which Class inherits.
 * 
 * The following diagram shows this relationship; vertical lines indicate parent/child
 * class relationships, horizontal lines indicate module inclusions. (C) means a class,
 * (M) a module.
 * 
 * 
 *      ==============      ==============      ==================      ==============
 *      | M | Kernel |----->| C | Module |      | C | OtherClass |<-----| M | Kernel |
 *      ==============      ==============      ==================      ==============
 *                                ^                     ^
 *                                |                     |
 *                                |                     |
 *                          =============       ==================
 *                          | C | Class |       | C | ChildClass |
 *                          =============       ==================
 * 
 * 
 * All objects have a metamodule attached to them; this handles storage of singleton
 * methods as metaclasses do in Ruby. This is handled by mixing the object's class into
 * the object's metamodule.
 * 
 * 
 *                class
 *          =================
 *          | C | SomeClass |------------------------------------------------
 *          =================                                               |
 *                  |                                                       |
 *                  V                                                       |
 *          ====================      =================================     |
 *          | <SomeClass:0xb7> |<>----| M | <Module:<SomeClass:0xb7>> |<-----
 *          ====================      =================================
 *                instance                       metamodule
 * 
 * 
 * Similarly, inheritance of class methods is handled by mixing the parent class's
 * metamodule into the child class's metamodule, like so:
 * 
 * 
 *            ==================      ===========================
 *            | C | OtherClass |<>----| M | <Module:OtherClass> |------
 *            ==================      ===========================     |
 *                    ^                                               |
 *                    |                                               |
 *                    |                                               |
 *            ==================      ===========================     |
 *            | C | ChildClass |<>----| M | <Module:ChildClass> |<-----
 *            ==================      ===========================
 * 
 * 
 * The parent-child relationships are also implemented using module inclusion, with some
 * extra checks and optimisations. Also, bear in mind that although Class appears to be a
 * subclass of Module, this particular parent-child relationship is faked using manual
 * delegation; every class has a hidden module attached to it that handles all the method
 * storage and lookup responsibilities.
 * 
 * @constructor
 * @class Module
 */
JS.Module = JS.makeFunction();
JS.extend(JS.Module.prototype, /** @scope Module.prototype */{
  /**
   * @param {Object} methods
   * @param {Object} options
   */
  initialize: function(methods, options) {
    options = options || {};
    
    this.__mod__ = this;      // Mirror property found in Class. Think of this as toModule()
    this.__inc__ = [];        // List of modules included in this module
    this.__fns__ = {};        // Object storing methods belonging to this module
    this.__dep__ = [];        // List modules and classes that depend on this module
    
    // Object to resolve methods onto
    this.__res__ = options._resolve || null;
    
    if (methods) this.include(methods);
  },
  
  /**
   * Adds an instance method to the module with the given name. The options parameter is
   * for internal use to make sure callbacks fire on the correct objects, e.g. a class
   * uses a hidden module to store its methods, but callbacks should fire on the class,
   * not the module.
   * 
   * @param {String} name
   * @param {Function} func
   * @param {Object} options
   */
  define: function(name, func, options) {
    var notify = (options || {})._notify || this;
    this.__fns__[name] = func;
    if (JS.Module._notify && notify && JS.isFn(func))
        JS.Module._notify(name, notify);
    var i = this.__dep__.length;
    while (i--) this.__dep__[i].resolve();
  },
  
  /**
   * Returns the named instance method from the module as an unbound function.
   * 
   * @param {String} name
   * @returns {Function}
   */
  instanceMethod: function(name) {
    var method = this.lookup(name).pop();
    return JS.isFn(method) ? method : null;
  },
  
  /**
   * Mixes a module into this one or, if module is plain old object (rather than a Module)
   * adds methods directly into this module. The options and resolve arguments are mostly
   * for internal use; options specifies objects that callbacks should fire on, and resolve
   * tells the module whether to resolve methods onto its target after adding the methods.
   * 
   * @param {Module|Object} module
   * @param {Object} options
   * @param {Boolean} resolve
   */
  include: function(module, options, resolve) {
    if (!module) return resolve && this.resolve();
    options = options || {};
    
    var inc      = module.include,
        ext      = module.extend,
        includer = options._included || this,
        modules, method, i, n;
    
    
    if (module.__inc__ && module.__fns__) {
      // module is a Module instance: make links and fire callbacks
      
      this.__inc__.push(module);
      module.__dep__.push(this);
      if (options._extended) module.extended && module.extended(options._extended);
      else module.included && module.included(includer);
      
    } else {
      // module is a normal object: add methods directly to this module
      
      if (options._recall) {
        // Second call: add all the methods
        for (method in module) {
          if (JS.ignore(method, module[method])) continue;
          this.define(method, module[method], {_notify: includer || options._extended || this});
        }
      } else {
        // First call: handle include and extend blocks
        
        // Handle inclusions
        if (typeof inc === 'object') {
          modules = [].concat(inc);
          for (i = 0, n = modules.length; i < n; i++)
            includer.include(modules[i], options);
        }
        
        // Handle extensions
        if (typeof ext === 'object') {
          modules = [].concat(ext);
          for (i = 0, n = modules.length; i < n; i++)
            includer.extend(modules[i], false);
          includer.extend();
        }
        
        // Make a second call to include(). This allows mixins to modify the
        // include() method and affect the addition of methods to this module
        options._recall = true;
        return includer.include(module, options, resolve);
      }
    }
    resolve && this.resolve();
  },
  
  /**
   * Returns true iff this module includes (i.e. inherits from) the given module, or if
   * the receiver and given module are the same object. Recurses over the receiver's
   * inheritance tree, could get expensive.
   * 
   * @param {Module} module
   * @returns {Boolean}
   */
  includes: function(module) {
    if (Object === module || this === module || this.__res__ === module.prototype)
      return true;
    var i = this.__inc__.length;
    while (i--) {
      if (this.__inc__[i].includes(module))
        return true;
    }
    return false;
  },
  
  /**
   * Returns an array of the module's ancestor modules/classes, with the most distant
   * first and the receiver last. This is the opposite order to that given by Ruby, but
   * this order makes it easier to eliminate duplicates and preserve Ruby's inheritance
   * semantics with respect to the diamond problem. The results parameter is for internal
   * use; we recurse over the tree passing the same array around rather than generating
   * lots of arrays and concatenating.
   * 
   * @param {Array} results
   * @returns {Array}
   */
  ancestors: function(results) {
    if (results === undefined && this.__anc__) return this.__anc__.slice();
    results = results || [];
    
    // Recurse over inclusions first
    for (var i = 0, n = this.__inc__.length; i < n; i++)
      this.__inc__[i].ancestors(results);
    
    // If this module is not already in the list, add it
    var klass = (this.__res__||{}).klass,
        result = (klass && this.__res__ === klass.prototype) ? klass : this;
    if (JS.indexOf(results, result) === -1) results.push(result);
    
    return this.__anc__ = results;
  },
  
  /**
   * Returns an array of all the methods in the module's inheritance tree with the given
   * name. Methods are returned in the same order as the modules in ancestors(), so the
   * last method in the list will be called first, the penultimate on the first callSuper(),
   * and so on back through the list.
   * 
   * @param {String} name
   * @returns {Array}
   */
  lookup: function(name) {
    var ancestors = this.ancestors(), results = [], i, n, method;
    for (i = 0, n = ancestors.length; i < n; i++) {
      method = ancestors[i].__mod__.__fns__[name];
      if (method) results.push(method);
    }
    return results;
  },
  
  /**
   * Returns a version of the function ready to be added to a prototype object. Functions
   * that use callSuper() must be wrapped to support that behaviour, other functions can
   * be used raw.
   * 
   * @param {String} name
   * @param {Function} func
   * @returns {Function}
   */
  make: function(name, func) {
    if (!JS.isFn(func) || !JS.callsSuper(func)) return func;
    var module = this;
    return function() {
      return module.chain(this, name, arguments);
    };
  },
  
  /**
   * Performs calls to functions that use callSuper(). Ancestor methods are looked up
   * dynamically at call-time; this allows callSuper() to be late-bound as in Ruby at the
   * cost of a little performance. Arguments to the call are stored so they can be passed
   * up the call stack automatically without the developer needing to pass them by hand.
   * 
   * @param {Object} self
   * @param {String} name
   * @param {Array} args
   * @returns {Object}
   */
  chain: JS.mask( function(self, name, args) {
    var callees      = this.lookup(name),     // List of method implementations
        stackIndex   = callees.length - 1,    // Current position in the call stack
        currentSuper = self.callSuper,        // Current super method attached to the receiver
        params       = JS.array(args),        // Copy of argument list
        result;
    
    // Set up the callSuper() method
    self.callSuper = function() {
    
      // Overwrite arguments specified explicitly
      var i = arguments.length;
      while (i--) params[i] = arguments[i];
      
      // Step up the stack, call and step back down
      stackIndex -= 1;
      var returnValue = callees[stackIndex].apply(self, params);
      stackIndex += 1;
      
      return returnValue;
    };
    
    // Call the last method in the stack
    result = callees.pop().apply(self, params);
    
    // Remove or reassign callSuper() method
    currentSuper ? self.callSuper = currentSuper : delete self.callSuper;
    
    return result;
  } ),
  
  /**
   * Copies methods from the module onto the target object, wrapping methods where
   * necessary. The target will typically be a native JavaScript prototype object used
   * to represent a class. Recurses over this module's ancestors to make sure all applicable
   * methods exist.
   * 
   * @param {Object} target
   */
  resolve: function(target) {
    var target = target || this, resolved = target.__res__, i, n, key, made;
    
    // Resolve all dependent modules if the target is this module
    if (target === this) {
      this.__anc__ = null;
      i = this.__dep__.length;
      while (i--) this.__dep__[i].resolve();
    }
    
    if (!resolved) return;
    
    // Recurse over this module's ancestors
    for (i = 0, n = this.__inc__.length; i < n; i++)
      this.__inc__[i].resolve(target);
    
    // Wrap and copy methods to the target
    for (key in this.__fns__) {
      made = target.make(key, this.__fns__[key]);
      if (resolved[key] !== made) resolved[key] = made;
    }
  }
});
