Console.extend({
  Browser: new JS.Class(Console.Base, {
    backtraceFilter: function() {
      return new RegExp(window.location.href.replace(/(\/[^\/]+)/g, '($1)?') + '/?', 'g');
    },

    coloring: function() {
      if (Console.envvar(Console.NO_COLOR)) return false;
      return Console.AIR || Console.PHANTOM;
    },

    echo: function(string) {
      if (window.runtime) return window.runtime.trace(string);
      if (window.console) return console.log(string);
      alert(string);
    },

    envvar: function(name) {
      if (Console.PHANTOM)
        return require('system').env[name] || null;
      else
        return window[name] || null;
    },

    exit: function(status) {
      if (Console.PHANTOM) phantom.exit(status);
    },

    getDimensions: function() {
      if (Console.AIR || Console.PHANTOM) return this.callSuper();
      return [1024, 1];
    }
  })
});

