/**
 * @file messageformat.js - ICU PluralFormat + SelectFormat for JavaScript
 * @author Alex Sexton - @SlexAxton
 * @version 0.3.0-0
 * @copyright 2012-2015 Alex Sexton, Eemeli Aro, and Contributors
 * @license To use or fork, MIT. To contribute back, Dojo CLA
 */


(function ( root ) {

  /**
   * Create a new message formatter
   *
   * @class
   * @global
   * @param {string|string[]} [locale="en"] - The locale to use, with fallbacks
   * @param {function} [pluralFunc] - Optional custom pluralization function
   * @param {function[]} [formatters] - Optional custom formatting functions
   */
  function MessageFormat(locale, pluralFunc, formatters) {
    if (!locale) {
      this.lc = ['en'];
    } else if (typeof locale == 'string') {
      this.lc = [];
      for (var l = locale; l; l = l.replace(/[-_]?[^-_]*$/, '')) this.lc.push(l);
    } else {
      this.lc = locale;
    }
    if (!pluralFunc) {
      pluralFunc = MessageFormat.getPluralFunc(this.lc);
      if (!pluralFunc) throw 'Plural function for locale `' + this.lc.join(',') + '` could not be loaded';
    }
    this.runtime.pluralFuncs = {};
    this.runtime.pluralFuncs[this.lc[0]] = pluralFunc;
    this.runtime.fmt = {};
    if (formatters) for (var f in formatters) {
      this.runtime.fmt[f] = formatters[f];
    }
  }

  /**
   * Publicly-accessible cache of pluralization functions, this is normally
   * filled by the internal `getPluralFunc()` function, but may be set
   * externally if e.g. the external dependency {@link
   * http://github.com/eemeli/make-plural.js make-plural} is not available.
   *
   * @memberof MessageFormat
   * @type Object.<string,function>
   * @example
   * > var MessageFormat = require('messageformat');
   * > MessageFormat.plurals.en = function(n) {  // cardinal plurals only
   *     return (n == 1 && !String(n).split('.')[1]) ? 'one' : 'other';
   *   };
   * > var mf = new MessageFormat('en');
   * > var mfunc = mf.compile('You have {N, plural, one{1 item} other{# items}.');
   * > mfunc({N:'1.0'})
   * "You have 1.0 items."
   */
  MessageFormat.plurals = {};

  /**
   * Look up the plural formatting function for a given locale code.
   *
   * If the {@link http://github.com/eemeli/make-plural.js make-plural module}
   * is not available, the {@link MessageFormat.plurals} object will need to be
   * pre-populated for this to work.
   *
   * @private
   * @memberof MessageFormat
   * @requires module:eemeli/make-plural.js
   * @param {string[]} locale - A preferentially ordered array of locale codes
   * @returns {function} The first match found for the given locale(s)
   */
  MessageFormat.getPluralFunc = function(locale) {
    var MakePlural = (typeof require != 'undefined') && require('make-plural') || root.MakePlural || function() { return false; };
    for (var i = 0; i < locale.length; ++i) {
      var lc = locale[i];
      if (lc in MessageFormat.plurals) {
        return MessageFormat.plurals[lc];
      }
      var fn = MakePlural(lc, {ordinals:1, quiet:1});
      if (fn) {
        MessageFormat.plurals[lc] = fn;
        return fn;
      }
    }
    return null;
  }

  /**
   * Default number formatting functions in the style of ICU's
   * {@link http://icu-project.org/apiref/icu4j/com/ibm/icu/text/MessageFormat.html simpleArg syntax}
   * implemented using the
   * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl Intl}
   * object defined by ECMA-402.
   *
   * **Note**: Intl is not defined in default Node until 0.11.15 / 0.12.0, so
   * earlier versions require a {@link https://www.npmjs.com/package/intl polyfill}.
   * Therefore {@link MessageFormat.withIntlSupport} needs to be true for these
   * functions to be available for inclusion in the output.
   *
   * @see MessageFormat#setIntlSupport
   *
   * @namespace
   * @memberof MessageFormat
   * @property {function} number - Represent a number as an integer, percent or currency value
   * @property {function} date - Represent a date as a full/long/default/short string
   * @property {function} time - Represent a time as a full/long/default/short string
   * @example
   * > var MessageFormat = require('messageformat');
   * > var mf = (new MessageFormat('en')).setIntlSupport(true);
   * > mf.currency = 'EUR';
   * > var mfunc = mf.compile("The total is {V,number,currency}.");
   * > mfunc({V:5.5})
   * "The total is €5.50."
   * @example
   * > var MessageFormat = require('messageformat');
   * > var mf = new MessageFormat('en', null, {number: MessageFormat.number});
   * > mf.currency = 'EUR';
   * > var mfunc = mf.compile("The total is {V,number,currency}.");
   * > mfunc({V:5.5})
   * "The total is €5.50."
   */
  MessageFormat.formatters = {
    number: function(self) {
      return new Function("v,lc,p",
        "return Intl.NumberFormat(lc,\n" +
        "    p=='integer' ? {maximumFractionDigits:0}\n" +
        "  : p=='percent' ? {style:'percent'}\n" +
        "  : p=='currency' ? {style:'currency', currency:'" + (self.currency || 'USD') + "', minimumFractionDigits:2, maximumFractionDigits:2}\n" +
        "  : {}).format(v)"
      );
    },
    date: function(v,lc,p) {
      var o = {day:'numeric', month:'short', year:'numeric'};
      switch (p) {
        case 'full': o.weekday = 'long';
        case 'long': o.month = 'long'; break;
        case 'short': o.month = 'numeric';
      }
      return (new Date(v)).toLocaleDateString(lc, o)
    },
    time: function(v,lc,p) {
      var o = {second:'numeric', minute:'numeric', hour:'numeric'};
      switch (p) {
        case 'full': case 'long': o.timeZoneName = 'short'; break;
        case 'short': delete o.minute;
      }
      return (new Date(v)).toLocaleTimeString(lc, o)
    }
  };

  /**
   * Enable or disable support for the default formatters, which require the
   * `Intl` object. Note that this can't be autodetected, as the environment
   * in which the formatted text is compiled into Javascript functions is not
   * necessarily the same environment in which they will get executed.
   *
   * @see MessageFormat.formatters
   *
   * @memberof MessageFormat
   * @param {boolean} [enable=true]
   * @returns {Object} The MessageFormat instance, to allow for chaining
   * @example
   * > var Intl = require('intl');
   * > var MessageFormat = require('messageformat');
   * > var mf = (new MessageFormat('en')).setIntlSupport(true);
   * > mf.currency = 'EUR';
   * > mf.compile("The total is {V,number,currency}.")({V:5.5});
   * "The total is €5.50."
   */
  MessageFormat.prototype.setIntlSupport = function(enable) {
      this.withIntlSupport = !!enable || (typeof enable == 'undefined');
      return this;
  };

  /**
   * A set of utility functions that are called by the compiled Javascript
   * functions, these are included locally in the output of {@link
   * MessageFormat#compile compile()}.
   *
   * @namespace
   * @memberof MessageFormat
   */
  MessageFormat.prototype.runtime = {
    /**
     * Utility function for `#` in plural rules
     *
     * @param {number} value - The value to operate on
     * @param {number} [offset=0] - An optional offset, set by the surrounding context
     */
    number: function(value, offset) {
      if (isNaN(value)) throw new Error("'" + value + "' isn't a number.");
      return value - (offset || 0);
    },

    /**
     * Utility function for `{N, plural|selectordinal, ...}`
     *
     * @param {number} value - The key to use to find a pluralization rule
     * @param {number} offset - An offset to apply to `value`
     * @param {function} lcfunc - A locale function from `pluralFuncs`
     * @param {Object.<string,string>} data - The object from which results are looked up
     * @param {?boolean} isOrdinal - If true, use ordinal rather than cardinal rules
     * @returns {string} The result of the pluralization
     */
    plural: function(value, offset, lcfunc, data, isOrdinal) {
      if ({}.hasOwnProperty.call(data, value)) return data[value]();
      if (offset) value -= offset;
      var key = lcfunc(value, isOrdinal);
      if (key in data) return data[key]();
      return data.other();
    },

    /**
     * Utility function for `{N, select, ...}`
     *
     * @param {number} value - The key to use to find a selection
     * @param {Object.<string,string>} data - The object from which results are looked up
     * @returns {string} The result of the select statement
     */
    select: function(value, data) {
      if ({}.hasOwnProperty.call(data, value)) return data[value]();
      return data.other()
    },

    /** Pluralization functions
     *  @instance
     *  @type Object.<string,function>  */
    pluralFuncs: {},

    /** Custom formatting functions called by `{var, fn[, args]*}` syntax
     *  @instance
     *  @see MessageFormat.formatters
     *  @type Object.<string,function>  */
    fmt: {},

    /** Custom stringifier to clean up browser inconsistencies */
    toString: function () {
      var _stringify = function(o, level) {
        if (typeof o != 'object') {
          var funcStr = o.toString().replace(/^(function )\w*/, '$1');
          var indent = /([ \t]*)\S.*$/.exec(funcStr);
          return indent ? funcStr.replace(new RegExp('^' + indent[1], 'mg'), '') : funcStr;
        }
        var s = [];
        for (var i in o) if (i != 'toString') {
          if (level == 0) s.push('var ' + i + ' = ' + _stringify(o[i], level + 1) + ';\n');
          else s.push(propname(i) + ': ' + _stringify(o[i], level + 1));
        }
        if (level == 0) return s.join('');
        if (s.length == 0) return '{}';
        var indent = '  '; while (--level) indent += '  ';
        return '{\n' + s.join(',\n').replace(/^/gm, indent) + '\n}';
      };
      return _stringify(this, 0);
    }
  };

  /** Parse an input string to its AST
   *  @private */
  MessageFormat._parse = function () {
    var mparser = require('pegjs').buildParser(require('fs').readFileSync(require('path').join(__dirname, 'messageformat-parser.pegjs'), {encoding: 'utf8'}));
    // Bind to itself so error handling works
    return mparser.parse.apply( mparser, arguments );
  };

  /** Utility function for quoting an Object's key value iff required
   *  @private */
  var propname = function(key, obj) {
    if (/^[A-Z_$][0-9A-Z_$]*$/i.test(key)) {
      return obj ? obj + '.' + key : key;
    } else {
      var jkey = JSON.stringify(key);
      return obj ? obj + '[' + jkey + ']' : jkey;
    }
  };

  /** Recursively map an AST to its resulting string
   *  @private */
  MessageFormat.prototype._precompile = function(ast, data) {
    data = data || { keys: {}, offset: {} };
    var r = [], i, tmp, args = [];

    switch ( ast.type ) {
      case 'messageFormatPattern':
        for ( i = 0; i < ast.statements.length; ++i ) {
          r.push(this._precompile( ast.statements[i], data ));
        }
        tmp = r.join(' + ') || '""';
        return data.pf_count ? tmp : 'function(d) { return ' + tmp + '; }';

      case 'messageFormatElement':
        data.pf_count = data.pf_count || 0;
        if ( ast.output ) {
          return propname(ast.argumentIndex, 'd');
        }
        else {
          data.keys[data.pf_count] = ast.argumentIndex;
          return this._precompile( ast.elementFormat, data );
        }
        return '';

      case 'elementFormat':
        var args = [ propname(data.keys[data.pf_count], 'd') ];
        switch (ast.key) {
          case 'select':
            args.push(this._precompile(ast.val, data));
            return 'select(' + args.join(', ') + ')';
          case 'selectordinal':
            args = args.concat([ 0, propname(this.lc[0], 'pluralFuncs'), this._precompile(ast.val, data), 1 ]);
            return 'plural(' + args.join(', ') + ')';
          case 'plural':
            data.offset[data.pf_count || 0] = ast.val.offset || 0;
            args = args.concat([ data.offset[data.pf_count] || 0, propname(this.lc[0], 'pluralFuncs'), this._precompile(ast.val, data) ]);
            return 'plural(' + args.join(', ') + ')';
          default:
            if (this.withIntlSupport && !(ast.key in this.runtime.fmt) && (ast.key in MessageFormat.formatters)) {
              tmp = MessageFormat.formatters[ast.key];
              this.runtime.fmt[ast.key] = (typeof tmp(this) == 'function') ? tmp(this) : tmp;
            }
            args.push(JSON.stringify(this.lc));
            if (ast.val && ast.val.length) args.push(JSON.stringify(ast.val.length == 1 ? ast.val[0] : ast.val));
            return 'fmt.' + ast.key + '(' + args.join(', ') + ')';
        }

      case 'pluralFormatPattern':
      case 'selectFormatPattern':
        data.pf_count = data.pf_count || 0;
        if (ast.type == 'selectFormatPattern') data.offset[data.pf_count] = 0;
        var needOther = true;
        for (i = 0; i < ast.pluralForms.length; ++i) {
          var key = ast.pluralForms[i].key;
          if (key === 'other') needOther = false;
          var data_copy = JSON.parse(JSON.stringify(data));
          data_copy.pf_count++;
          r.push(propname(key) + ': function() { return ' + this._precompile(ast.pluralForms[i].val, data_copy) + ';}');
        }
        if (needOther) throw new Error("No 'other' form found in " + ast.type + " " + data.pf_count);
        return '{ ' + r.join(', ') + ' }';

      case 'string':
        tmp = '"' + (ast.val || "").replace(/\n/g, '\\n').replace(/"/g, '\\"') + '"';
        if ( data.pf_count ) {
          args = [ propname(data.keys[data.pf_count-1], 'd') ];
          if (data.offset[data.pf_count-1]) args.push(data.offset[data.pf_count-1]);
          tmp = tmp.replace(/(^|[^\\])#/g, '$1"+' + 'number(' + args.join(', ') + ')+"');
          tmp = tmp.replace(/^""\+/, '').replace(/\+""$/, '');
        }
        return tmp;

      default:
        throw new Error( 'Bad AST type: ' + ast.type );
    }
  };

  /**
   * Compile messages into an executable function with clean string
   * representation.
   *
   * If `messages` is a single string including ICU MessageFormat declarations,
   * `opt` is ignored and the returned function takes a single Object parameter
   * `d` representing each of the input's defined variables. The returned
   * function will be defined in a local scope that includes all the required
   * runtime variables.
   *
   * If `messages` is a map of keys to strings, or a map of namespace keys to
   * such key/string maps, the returned function will fill the specified global
   * with javascript functions matching the structure of the input. In such use,
   * the output of `compile()` is expected to be serialized using `.toString()`,
   * and will include definitions of the runtime functions.
   *
   * Together, the input parameters should match the following patterns:
   * ```js
   * messages = "string" || { key0: "string0", key1: "string1", ... } || {
   *   ns0: { key0: "string0", key1: "string1", ...  },
   *   ns1: { key0: "string0", key1: "string1", ...  },
   *   ...
   * }
   *
   * opt = null || {
   *   locale: null || {
   *     ns0: "lc0" || [ "lc0", ... ],
   *     ns1: "lc1" || [ "lc1", ... ],
   *     ...
   *   },
   *   global: null || "module.exports" || "exports" || "i18n" || ...
   * }
   * ```
   *
   * @memberof MessageFormat
   * @param {string|Object}
   *     messages - The input message(s) to be compiled, in ICU MessageFormat
   * @param {Object} [opt={}] - Options controlling output for non-simple intput
   * @param {Object} [opt.locale] - The locales to use for the messages, with a
   *     structure matching that of `messages`
   * @param {string} [opt.global=""] - The global variable that the output
   *     function should use, or a null string for none. "exports" and
   *     "module.exports" are recognised as special cases.
   * @returns {function} The first match found for the given locale(s)
   */
  MessageFormat.prototype.compile = function ( messages, opt ) {
    var r = {}, lc0 = this.lc,
        compileMsg = function(self, msg) {
          try {
            var ast = MessageFormat._parse(msg);
            return self._precompile(ast);
          } catch (e) {
            throw new Error((ast ? 'Precompiler' : 'Parser') + ' error: ' + e.toString());
          }
        },
        stringify = function(r, level) {
          if (!level) level = 0;
          if (typeof r != 'object') return r;
          var o = [], indent = '';
          for (var i = 0; i < level; ++i) indent += '  ';
          for (var k in r) o.push('\n' + indent + '  ' + propname(k) + ': ' + stringify(r[k], level + 1));
          return '{' + o.join(',') + '\n' + indent + '}';
        };

    if (typeof messages == 'string') {
      var f = new Function(
          'number, plural, select, pluralFuncs, fmt',
          'return ' + compileMsg(this, messages));
      return f(this.runtime.number, this.runtime.plural, this.runtime.select,
          this.runtime.pluralFuncs, this.runtime.fmt);
    }

    opt = opt || {};

    for (var ns in messages) {
      if (opt.locale) this.lc = opt.locale[ns] && [].concat(opt.locale[ns]) || lc0;
      if (typeof messages[ns] == 'string') {
        try { r[ns] = compileMsg(this, messages[ns]); }
        catch (e) { e.message = e.message.replace(':', ' with `' + ns + '`:'); throw e; }
      } else {
        r[ns] = {};
        for (var key in messages[ns]) {
          try { r[ns][key] = compileMsg(this, messages[ns][key]); }
          catch (e) { e.message = e.message.replace(':', ' with `' + key + '` in `' + ns + '`:'); throw e; }
        }
      }
    }

    this.lc = lc0;
    var s = this.runtime.toString() + '\n';
    switch (opt.global || '') {
      case 'exports':
        var o = [];
        for (var k in r) o.push(propname(k, 'exports') + ' = ' + stringify(r[k]));
        return new Function(s + o.join(';\n'));
      case 'module.exports':
        return new Function(s + 'module.exports = ' + stringify(r));
      case '':
        return new Function(s + 'return ' + stringify(r));
      default:
        return new Function('G', s + propname(opt.global, 'G') + ' = ' + stringify(r));
    }
  };


  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = MessageFormat;
    }
    exports.MessageFormat = MessageFormat;
  }
  else if (typeof define === 'function' && define.amd) {
    define(['make-plural'], function() {
      return MessageFormat;
    });
  }
  else {
    root['MessageFormat'] = MessageFormat;
  }

})( this );