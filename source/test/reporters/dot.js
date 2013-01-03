Test.Reporters.extend({
  Dot: new JS.Class({
    include: Console,

    SYMBOLS: {
      failure:  'F',
      error:    'E'
    },

    NAMES: {
      failure:  'Failure',
      error:    'Error'
    },

    startSuite: function(event) {
      this._faults = [];

      this.consoleFormat('bold');
      this.puts('Loaded suite: ' + event.fullName);
      this.puts('');
      this.reset();
      this.puts('Started');
    },

    startContext: function(event) {},

    startTest: function(event) {
      this._outputFault = false;
    },

    addFault: function(event) {
      this._faults.push(event);
      if (this._outputFault) return;
      this._outputFault = true;
      this.consoleFormat('bold', 'red');
      this.print(this.SYMBOLS[event.error.type]);
      this.reset();
    },

    endTest: function(event) {
      if (this._outputFault) return;
      this.consoleFormat('green');
      this.print('.');
      this.reset();
    },

    endContext: function(event) {},

    update: function(event) {},

    endSuite: function(event) {
      for (var i = 0, n = this._faults.length; i < n; i++)
        this._printFault(i + 1, this._faults[i]);

      this._printSummary(event);
    },

    _printFault: function(index, fault) {
      this.puts('');
      this.consoleFormat('bold', 'red');
      this.puts('\n' + index + ') ' + this.NAMES[fault.error.type] + ': ' + fault.test.fullName);
      this.reset();
      this.puts(fault.error.message);
      if (fault.error.backtrace) this.puts(fault.error.backtrace);
      this.reset();
    },

    _printSummary: function(event) {
      this.reset();
      this.puts('');
      this.puts('Finished in ' + event.runtime + ' seconds');

      var color = event.passed ? 'green' : 'red';
      this.consoleFormat(color);
      this.puts(this._plural(event.tests, 'test') + ', ' +
                this._plural(event.assertions, 'assertion') + ', ' +
                this._plural(event.failures, 'failure') + ', ' +
                this._plural(event.errors, 'error'));
      this.reset();
      this.puts('');
    },

    _plural: function(number, noun) {
      return number + ' ' + noun + (number === 1 ? '' : 's');
    }
  })
});

Test.Reporters.register('dot', Test.Reporters.Dot);

