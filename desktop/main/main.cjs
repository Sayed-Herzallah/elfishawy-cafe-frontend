var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/sql.js/dist/sql-wasm.js
var require_sql_wasm = __commonJS({
  "node_modules/sql.js/dist/sql-wasm.js"(exports2, module2) {
    var initSqlJsPromise = void 0;
    var initSqlJs2 = function(moduleConfig) {
      if (initSqlJsPromise) {
        return initSqlJsPromise;
      }
      initSqlJsPromise = new Promise(function(resolveModule, reject) {
        var Module = typeof moduleConfig !== "undefined" ? moduleConfig : {};
        var originalOnAbortFunction = Module["onAbort"];
        Module["onAbort"] = function(errorThatCausedAbort) {
          reject(new Error(errorThatCausedAbort));
          if (originalOnAbortFunction) {
            originalOnAbortFunction(errorThatCausedAbort);
          }
        };
        Module["postRun"] = Module["postRun"] || [];
        Module["postRun"].push(function() {
          resolveModule(Module);
        });
        module2 = void 0;
        var k;
        k ||= typeof Module != "undefined" ? Module : {};
        var aa = !!globalThis.window, ba = !!globalThis.WorkerGlobalScope, ca = globalThis.process?.versions?.node && "renderer" != globalThis.process?.type;
        k.onRuntimeInitialized = function() {
          function a(f, l) {
            switch (typeof l) {
              case "boolean":
                dc(f, l ? 1 : 0);
                break;
              case "number":
                ec(f, l);
                break;
              case "string":
                fc(f, l, -1, -1);
                break;
              case "object":
                if (null === l) lb(f);
                else if (null != l.length) {
                  var n = da(l.length);
                  m.set(l, n);
                  gc(f, n, l.length, -1);
                  ea(n);
                } else va(f, "Wrong API use : tried to return a value of an unknown type (" + l + ").", -1);
                break;
              default:
                lb(f);
            }
          }
          function b(f, l) {
            for (var n = [], p = 0; p < f; p += 1) {
              var r = t(l + 4 * p, "i32"), w = hc(r);
              if (1 === w || 2 === w) r = ic(r);
              else if (3 === w) r = jc(r);
              else if (4 === w) {
                w = r;
                r = kc(w);
                w = lc(w);
                for (var J = new Uint8Array(r), I = 0; I < r; I += 1) J[I] = m[w + I];
                r = J;
              } else r = null;
              n.push(r);
            }
            return n;
          }
          function c(f, l) {
            this.Qa = f;
            this.db = l;
            this.Oa = 1;
            this.mb = [];
          }
          function d(f, l) {
            this.db = l;
            this.fb = fa(f);
            if (null === this.fb) throw Error("Unable to allocate memory for the SQL string");
            this.lb = this.fb;
            this.$a = this.sb = null;
          }
          function e(f) {
            this.filename = "dbfile_" + (4294967295 * Math.random() >>> 0);
            if (null != f) {
              var l = this.filename, n = "/", p = l;
              n && (n = "string" == typeof n ? n : ha(n), p = l ? ia(n + "/" + l) : n);
              l = ja(true, true);
              p = ka(
                p,
                l
              );
              if (f) {
                if ("string" == typeof f) {
                  n = Array(f.length);
                  for (var r = 0, w = f.length; r < w; ++r) n[r] = f.charCodeAt(r);
                  f = n;
                }
                ma(p, l | 146);
                n = na(p, 577);
                oa(n, f, 0, f.length, 0);
                pa(n);
                ma(p, l);
              }
            }
            this.handleError(q(this.filename, g));
            this.db = t(g, "i32");
            ob(this.db);
            this.gb = {};
            this.Sa = {};
          }
          var g = y(4), h = k.cwrap, q = h("sqlite3_open", "number", ["string", "number"]), v = h("sqlite3_close_v2", "number", ["number"]), u = h("sqlite3_exec", "number", ["number", "string", "number", "number", "number"]), x = h("sqlite3_changes", "number", ["number"]), D = h(
            "sqlite3_prepare_v2",
            "number",
            ["number", "string", "number", "number", "number"]
          ), pb = h("sqlite3_sql", "string", ["number"]), nc = h("sqlite3_normalized_sql", "string", ["number"]), qb = h("sqlite3_prepare_v2", "number", ["number", "number", "number", "number", "number"]), oc = h("sqlite3_bind_text", "number", ["number", "number", "number", "number", "number"]), rb = h("sqlite3_bind_blob", "number", ["number", "number", "number", "number", "number"]), pc = h("sqlite3_bind_double", "number", ["number", "number", "number"]), qc = h("sqlite3_bind_int", "number", [
            "number",
            "number",
            "number"
          ]), rc = h("sqlite3_bind_parameter_index", "number", ["number", "string"]), sc = h("sqlite3_step", "number", ["number"]), tc = h("sqlite3_errmsg", "string", ["number"]), uc = h("sqlite3_column_count", "number", ["number"]), vc = h("sqlite3_data_count", "number", ["number"]), wc = h("sqlite3_column_double", "number", ["number", "number"]), sb = h("sqlite3_column_text", "string", ["number", "number"]), xc = h("sqlite3_column_blob", "number", ["number", "number"]), yc = h("sqlite3_column_bytes", "number", ["number", "number"]), zc = h(
            "sqlite3_column_type",
            "number",
            ["number", "number"]
          ), Ac = h("sqlite3_column_name", "string", ["number", "number"]), Bc = h("sqlite3_reset", "number", ["number"]), Cc = h("sqlite3_clear_bindings", "number", ["number"]), Dc = h("sqlite3_finalize", "number", ["number"]), tb = h("sqlite3_create_function_v2", "number", "number string number number number number number number number".split(" ")), hc = h("sqlite3_value_type", "number", ["number"]), kc = h("sqlite3_value_bytes", "number", ["number"]), jc = h("sqlite3_value_text", "string", ["number"]), lc = h(
            "sqlite3_value_blob",
            "number",
            ["number"]
          ), ic = h("sqlite3_value_double", "number", ["number"]), ec = h("sqlite3_result_double", "", ["number", "number"]), lb = h("sqlite3_result_null", "", ["number"]), fc = h("sqlite3_result_text", "", ["number", "string", "number", "number"]), gc = h("sqlite3_result_blob", "", ["number", "number", "number", "number"]), dc = h("sqlite3_result_int", "", ["number", "number"]), va = h("sqlite3_result_error", "", ["number", "string", "number"]), ub = h("sqlite3_aggregate_context", "number", ["number", "number"]), ob = h(
            "RegisterExtensionFunctions",
            "number",
            ["number"]
          ), vb = h("sqlite3_update_hook", "number", ["number", "number", "number"]);
          c.prototype.bind = function(f) {
            if (!this.Qa) throw "Statement closed";
            this.reset();
            return Array.isArray(f) ? this.Gb(f) : null != f && "object" === typeof f ? this.Hb(f) : true;
          };
          c.prototype.step = function() {
            if (!this.Qa) throw "Statement closed";
            this.Oa = 1;
            var f = sc(this.Qa);
            switch (f) {
              case 100:
                return true;
              case 101:
                return false;
              default:
                throw this.db.handleError(f);
            }
          };
          c.prototype.Ab = function(f) {
            null == f && (f = this.Oa, this.Oa += 1);
            return wc(this.Qa, f);
          };
          c.prototype.Ob = function(f) {
            null == f && (f = this.Oa, this.Oa += 1);
            f = sb(this.Qa, f);
            if ("function" !== typeof BigInt) throw Error("BigInt is not supported");
            return BigInt(f);
          };
          c.prototype.Tb = function(f) {
            null == f && (f = this.Oa, this.Oa += 1);
            return sb(this.Qa, f);
          };
          c.prototype.getBlob = function(f) {
            null == f && (f = this.Oa, this.Oa += 1);
            var l = yc(this.Qa, f);
            f = xc(this.Qa, f);
            for (var n = new Uint8Array(l), p = 0; p < l; p += 1) n[p] = m[f + p];
            return n;
          };
          c.prototype.get = function(f, l) {
            l = l || {};
            null != f && this.bind(f) && this.step();
            f = [];
            for (var n = vc(this.Qa), p = 0; p < n; p += 1) switch (zc(this.Qa, p)) {
              case 1:
                var r = l.useBigInt ? this.Ob(p) : this.Ab(p);
                f.push(r);
                break;
              case 2:
                f.push(this.Ab(p));
                break;
              case 3:
                f.push(this.Tb(p));
                break;
              case 4:
                f.push(this.getBlob(p));
                break;
              default:
                f.push(null);
            }
            return f;
          };
          c.prototype.qb = function() {
            for (var f = [], l = uc(this.Qa), n = 0; n < l; n += 1) f.push(Ac(this.Qa, n));
            return f;
          };
          c.prototype.zb = function(f, l) {
            f = this.get(f, l);
            l = this.qb();
            for (var n = {}, p = 0; p < l.length; p += 1) n[l[p]] = f[p];
            return n;
          };
          c.prototype.Sb = function() {
            return pb(this.Qa);
          };
          c.prototype.Pb = function() {
            return nc(this.Qa);
          };
          c.prototype.run = function(f) {
            null != f && this.bind(f);
            this.step();
            return this.reset();
          };
          c.prototype.wb = function(f, l) {
            null == l && (l = this.Oa, this.Oa += 1);
            f = fa(f);
            this.mb.push(f);
            this.db.handleError(oc(this.Qa, l, f, -1, 0));
          };
          c.prototype.Fb = function(f, l) {
            null == l && (l = this.Oa, this.Oa += 1);
            var n = da(f.length);
            m.set(f, n);
            this.mb.push(n);
            this.db.handleError(rb(this.Qa, l, n, f.length, 0));
          };
          c.prototype.vb = function(f, l) {
            null == l && (l = this.Oa, this.Oa += 1);
            this.db.handleError((f === (f | 0) ? qc : pc)(
              this.Qa,
              l,
              f
            ));
          };
          c.prototype.Ib = function(f) {
            null == f && (f = this.Oa, this.Oa += 1);
            rb(this.Qa, f, 0, 0, 0);
          };
          c.prototype.xb = function(f, l) {
            null == l && (l = this.Oa, this.Oa += 1);
            switch (typeof f) {
              case "string":
                this.wb(f, l);
                return;
              case "number":
                this.vb(f, l);
                return;
              case "bigint":
                this.wb(f.toString(), l);
                return;
              case "boolean":
                this.vb(f + 0, l);
                return;
              case "object":
                if (null === f) {
                  this.Ib(l);
                  return;
                }
                if (null != f.length) {
                  this.Fb(f, l);
                  return;
                }
            }
            throw "Wrong API use : tried to bind a value of an unknown type (" + f + ").";
          };
          c.prototype.Hb = function(f) {
            var l = this;
            Object.keys(f).forEach(function(n) {
              var p = rc(l.Qa, n);
              0 !== p && l.xb(f[n], p);
            });
            return true;
          };
          c.prototype.Gb = function(f) {
            for (var l = 0; l < f.length; l += 1) this.xb(f[l], l + 1);
            return true;
          };
          c.prototype.reset = function() {
            this.freemem();
            return 0 === Cc(this.Qa) && 0 === Bc(this.Qa);
          };
          c.prototype.freemem = function() {
            for (var f; void 0 !== (f = this.mb.pop()); ) ea(f);
          };
          c.prototype.Ya = function() {
            this.freemem();
            var f = 0 === Dc(this.Qa);
            delete this.db.gb[this.Qa];
            this.Qa = 0;
            return f;
          };
          d.prototype.next = function() {
            if (null === this.fb) return { done: true };
            null !== this.$a && (this.$a.Ya(), this.$a = null);
            if (!this.db.db) throw this.ob(), Error("Database closed");
            var f = qa(), l = y(4);
            ra(g);
            ra(l);
            try {
              this.db.handleError(qb(this.db.db, this.lb, -1, g, l));
              this.lb = t(l, "i32");
              var n = t(g, "i32");
              if (0 === n) return this.ob(), { done: true };
              this.$a = new c(n, this.db);
              this.db.gb[n] = this.$a;
              return { value: this.$a, done: false };
            } catch (p) {
              throw this.sb = z(this.lb), this.ob(), p;
            } finally {
              sa(f);
            }
          };
          d.prototype.ob = function() {
            ea(this.fb);
            this.fb = null;
          };
          d.prototype.Qb = function() {
            return null !== this.sb ? this.sb : z(this.lb);
          };
          "function" === typeof Symbol && "symbol" === typeof Symbol.iterator && (d.prototype[Symbol.iterator] = function() {
            return this;
          });
          e.prototype.run = function(f, l) {
            if (!this.db) throw "Database closed";
            if (l) {
              f = this.tb(f, l);
              try {
                f.step();
              } finally {
                f.Ya();
              }
            } else this.handleError(u(this.db, f, 0, 0, g));
            return this;
          };
          e.prototype.exec = function(f, l, n) {
            if (!this.db) throw "Database closed";
            var p = qa(), r = null, w = null, J = null;
            try {
              J = w = fa(f);
              var I = y(4);
              for (f = []; 0 !== t(J, "i8"); ) {
                ra(g);
                ra(I);
                this.handleError(qb(this.db, J, -1, g, I));
                var L = t(g, "i32");
                J = t(I, "i32");
                if (0 !== L) {
                  var G = null;
                  r = new c(L, this);
                  for (null != l && r.bind(l); r.step(); ) null === G && (G = { columns: r.qb(), values: [] }, f.push(G)), G.values.push(r.get(null, n));
                  r.Ya();
                }
              }
              return f;
            } catch (la) {
              throw r && r.Ya(), la;
            } finally {
              w && ea(w), sa(p);
            }
          };
          e.prototype.Mb = function(f, l, n, p, r) {
            "function" === typeof l && (p = n, n = l, l = void 0);
            f = this.tb(f, l);
            try {
              for (; f.step(); ) n(f.zb(null, r));
            } finally {
              f.Ya();
            }
            if ("function" === typeof p) return p();
          };
          e.prototype.tb = function(f, l) {
            ra(g);
            this.handleError(D(this.db, f, -1, g, 0));
            f = t(g, "i32");
            if (0 === f) throw "Nothing to prepare";
            var n = new c(f, this);
            null != l && n.bind(l);
            return this.gb[f] = n;
          };
          e.prototype.Ub = function(f) {
            return new d(f, this);
          };
          e.prototype.Nb = function() {
            Object.values(this.gb).forEach(function(l) {
              l.Ya();
            });
            Object.values(this.Sa).forEach(A);
            this.Sa = {};
            this.handleError(v(this.db));
            var f = ta(this.filename);
            this.handleError(q(this.filename, g));
            this.db = t(g, "i32");
            ob(this.db);
            return f;
          };
          e.prototype.close = function() {
            null !== this.db && (Object.values(this.gb).forEach(function(f) {
              f.Ya();
            }), Object.values(this.Sa).forEach(A), this.Sa = {}, this.Za && (A(this.Za), this.Za = void 0), this.handleError(v(this.db)), ua("/" + this.filename), this.db = null);
          };
          e.prototype.handleError = function(f) {
            if (0 === f) return null;
            f = tc(this.db);
            throw Error(f);
          };
          e.prototype.Rb = function() {
            return x(this.db);
          };
          e.prototype.Kb = function(f, l) {
            Object.prototype.hasOwnProperty.call(this.Sa, f) && (A(this.Sa[f]), delete this.Sa[f]);
            var n = wa(function(p, r, w) {
              r = b(r, w);
              try {
                var J = l.apply(null, r);
              } catch (I) {
                va(p, I, -1);
                return;
              }
              a(p, J);
            }, "viii");
            this.Sa[f] = n;
            this.handleError(tb(this.db, f, l.length, 1, 0, n, 0, 0, 0));
            return this;
          };
          e.prototype.Jb = function(f, l) {
            var n = l.init || function() {
              return null;
            }, p = l.finalize || function(L) {
              return L;
            }, r = l.step;
            if (!r) throw "An aggregate function must have a step function in " + f;
            var w = {};
            Object.hasOwnProperty.call(this.Sa, f) && (A(this.Sa[f]), delete this.Sa[f]);
            l = f + "__finalize";
            Object.hasOwnProperty.call(this.Sa, l) && (A(this.Sa[l]), delete this.Sa[l]);
            var J = wa(function(L, G, la) {
              var V = ub(L, 1);
              Object.hasOwnProperty.call(w, V) || (w[V] = n());
              G = b(G, la);
              G = [w[V]].concat(G);
              try {
                w[V] = r.apply(null, G);
              } catch (Fc) {
                delete w[V], va(L, Fc, -1);
              }
            }, "viii"), I = wa(function(L) {
              var G = ub(L, 1);
              try {
                var la = p(w[G]);
              } catch (V) {
                delete w[G];
                va(L, V, -1);
                return;
              }
              a(L, la);
              delete w[G];
            }, "vi");
            this.Sa[f] = J;
            this.Sa[l] = I;
            this.handleError(tb(this.db, f, r.length - 1, 1, 0, 0, J, I, 0));
            return this;
          };
          e.prototype.Zb = function(f) {
            this.Za && (vb(this.db, 0, 0), A(this.Za), this.Za = void 0);
            if (!f) return this;
            this.Za = wa(function(l, n, p, r, w) {
              switch (n) {
                case 18:
                  l = "insert";
                  break;
                case 23:
                  l = "update";
                  break;
                case 9:
                  l = "delete";
                  break;
                default:
                  throw "unknown operationCode in updateHook callback: " + n;
              }
              p = z(p);
              r = z(r);
              if (w > Number.MAX_SAFE_INTEGER) throw "rowId too big to fit inside a Number";
              f(l, p, r, Number(w));
            }, "viiiij");
            vb(this.db, this.Za, 0);
            return this;
          };
          c.prototype.bind = c.prototype.bind;
          c.prototype.step = c.prototype.step;
          c.prototype.get = c.prototype.get;
          c.prototype.getColumnNames = c.prototype.qb;
          c.prototype.getAsObject = c.prototype.zb;
          c.prototype.getSQL = c.prototype.Sb;
          c.prototype.getNormalizedSQL = c.prototype.Pb;
          c.prototype.run = c.prototype.run;
          c.prototype.reset = c.prototype.reset;
          c.prototype.freemem = c.prototype.freemem;
          c.prototype.free = c.prototype.Ya;
          d.prototype.next = d.prototype.next;
          d.prototype.getRemainingSQL = d.prototype.Qb;
          e.prototype.run = e.prototype.run;
          e.prototype.exec = e.prototype.exec;
          e.prototype.each = e.prototype.Mb;
          e.prototype.prepare = e.prototype.tb;
          e.prototype.iterateStatements = e.prototype.Ub;
          e.prototype["export"] = e.prototype.Nb;
          e.prototype.close = e.prototype.close;
          e.prototype.handleError = e.prototype.handleError;
          e.prototype.getRowsModified = e.prototype.Rb;
          e.prototype.create_function = e.prototype.Kb;
          e.prototype.create_aggregate = e.prototype.Jb;
          e.prototype.updateHook = e.prototype.Zb;
          k.Database = e;
        };
        var xa = "./this.program", ya = (a, b) => {
          throw b;
        }, za = globalThis.document?.currentScript?.src;
        "undefined" != typeof __filename ? za = __filename : ba && (za = self.location.href);
        var Aa = "", Ba, Ca;
        if (ca) {
          var fs5 = require("node:fs");
          Aa = __dirname + "/";
          Ca = (a) => {
            a = Da(a) ? new URL(a) : a;
            return fs5.readFileSync(a);
          };
          Ba = async (a) => {
            a = Da(a) ? new URL(a) : a;
            return fs5.readFileSync(a, void 0);
          };
          1 < process.argv.length && (xa = process.argv[1].replace(/\\/g, "/"));
          process.argv.slice(2);
          "undefined" != typeof module2 && (module2.exports = k);
          ya = (a, b) => {
            process.exitCode = a;
            throw b;
          };
        } else if (aa || ba) {
          try {
            Aa = new URL(".", za).href;
          } catch {
          }
          ba && (Ca = (a) => {
            var b = new XMLHttpRequest();
            b.open("GET", a, false);
            b.responseType = "arraybuffer";
            b.send(null);
            return new Uint8Array(b.response);
          });
          Ba = async (a) => {
            if (Da(a)) return new Promise((c, d) => {
              var e = new XMLHttpRequest();
              e.open("GET", a, true);
              e.responseType = "arraybuffer";
              e.onload = () => {
                200 == e.status || 0 == e.status && e.response ? c(e.response) : d(e.status);
              };
              e.onerror = d;
              e.send(null);
            });
            var b = await fetch(a, { credentials: "same-origin" });
            if (b.ok) return b.arrayBuffer();
            throw Error(b.status + " : " + b.url);
          };
        }
        var Ea = console.log.bind(console), B = console.error.bind(console), Fa, Ga = false, Ha, Da = (a) => a.startsWith("file://"), m, C, Ia, E, F, Ja, Ka, H;
        function La() {
          var a = Ma.buffer;
          m = new Int8Array(a);
          Ia = new Int16Array(a);
          C = new Uint8Array(a);
          new Uint16Array(a);
          E = new Int32Array(a);
          F = new Uint32Array(a);
          Ja = new Float32Array(a);
          Ka = new Float64Array(a);
          H = new BigInt64Array(a);
          new BigUint64Array(a);
        }
        function Na(a) {
          k.onAbort?.(a);
          a = "Aborted(" + a + ")";
          B(a);
          Ga = true;
          throw new WebAssembly.RuntimeError(a + ". Build with -sASSERTIONS for more info.");
        }
        var Oa;
        async function Pa(a) {
          if (!Fa) try {
            var b = await Ba(a);
            return new Uint8Array(b);
          } catch {
          }
          if (a == Oa && Fa) a = new Uint8Array(Fa);
          else if (Ca) a = Ca(a);
          else throw "both async and sync fetching of the wasm failed";
          return a;
        }
        async function Qa(a, b) {
          try {
            var c = await Pa(a);
            return await WebAssembly.instantiate(c, b);
          } catch (d) {
            B(`failed to asynchronously prepare wasm: ${d}`), Na(d);
          }
        }
        async function Ra(a) {
          var b = Oa;
          if (!Fa && !Da(b) && !ca) try {
            var c = fetch(b, { credentials: "same-origin" });
            return await WebAssembly.instantiateStreaming(c, a);
          } catch (d) {
            B(`wasm streaming compile failed: ${d}`), B("falling back to ArrayBuffer instantiation");
          }
          return Qa(b, a);
        }
        class Sa {
          name = "ExitStatus";
          constructor(a) {
            this.message = `Program terminated with exit(${a})`;
            this.status = a;
          }
        }
        var Ta = (a) => {
          for (; 0 < a.length; ) a.shift()(k);
        }, Ua = [], Va = [], Wa = () => {
          var a = k.preRun.shift();
          Va.push(a);
        }, K = 0, Xa = null;
        function t(a, b = "i8") {
          b.endsWith("*") && (b = "*");
          switch (b) {
            case "i1":
              return m[a];
            case "i8":
              return m[a];
            case "i16":
              return Ia[a >> 1];
            case "i32":
              return E[a >> 2];
            case "i64":
              return H[a >> 3];
            case "float":
              return Ja[a >> 2];
            case "double":
              return Ka[a >> 3];
            case "*":
              return F[a >> 2];
            default:
              Na(`invalid type for getValue: ${b}`);
          }
        }
        var Ya = true;
        function ra(a) {
          var b = "i32";
          b.endsWith("*") && (b = "*");
          switch (b) {
            case "i1":
              m[a] = 0;
              break;
            case "i8":
              m[a] = 0;
              break;
            case "i16":
              Ia[a >> 1] = 0;
              break;
            case "i32":
              E[a >> 2] = 0;
              break;
            case "i64":
              H[a >> 3] = BigInt(0);
              break;
            case "float":
              Ja[a >> 2] = 0;
              break;
            case "double":
              Ka[a >> 3] = 0;
              break;
            case "*":
              F[a >> 2] = 0;
              break;
            default:
              Na(`invalid type for setValue: ${b}`);
          }
        }
        var Za = new TextDecoder(), $a = (a, b, c, d) => {
          c = b + c;
          if (d) return c;
          for (; a[b] && !(b >= c); ) ++b;
          return b;
        }, z = (a, b, c) => a ? Za.decode(C.subarray(a, $a(C, a, b, c))) : "", ab = (a, b) => {
          for (var c = 0, d = a.length - 1; 0 <= d; d--) {
            var e = a[d];
            "." === e ? a.splice(d, 1) : ".." === e ? (a.splice(d, 1), c++) : c && (a.splice(d, 1), c--);
          }
          if (b) for (; c; c--) a.unshift("..");
          return a;
        }, ia = (a) => {
          var b = "/" === a.charAt(0), c = "/" === a.slice(-1);
          (a = ab(a.split("/").filter((d) => !!d), !b).join("/")) || b || (a = ".");
          a && c && (a += "/");
          return (b ? "/" : "") + a;
        }, bb = (a) => {
          var b = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/.exec(a).slice(1);
          a = b[0];
          b = b[1];
          if (!a && !b) return ".";
          b &&= b.slice(0, -1);
          return a + b;
        }, cb = (a) => a && a.match(/([^\/]+|\/)\/*$/)[1], db = () => {
          if (ca) {
            var a = require("node:crypto");
            return (b) => a.randomFillSync(b);
          }
          return (b) => crypto.getRandomValues(b);
        }, eb = (a) => {
          (eb = db())(a);
        }, fb = (...a) => {
          for (var b = "", c = false, d = a.length - 1; -1 <= d && !c; d--) {
            c = 0 <= d ? a[d] : "/";
            if ("string" != typeof c) throw new TypeError("Arguments to path.resolve must be strings");
            if (!c) return "";
            b = c + "/" + b;
            c = "/" === c.charAt(0);
          }
          b = ab(b.split("/").filter((e) => !!e), !c).join("/");
          return (c ? "/" : "") + b || ".";
        }, gb = (a) => {
          var b = $a(a, 0);
          return Za.decode(a.buffer ? a.subarray(0, b) : new Uint8Array(a.slice(0, b)));
        }, hb = [], ib = (a) => {
          for (var b = 0, c = 0; c < a.length; ++c) {
            var d = a.charCodeAt(c);
            127 >= d ? b++ : 2047 >= d ? b += 2 : 55296 <= d && 57343 >= d ? (b += 4, ++c) : b += 3;
          }
          return b;
        }, M = (a, b, c, d) => {
          if (!(0 < d)) return 0;
          var e = c;
          d = c + d - 1;
          for (var g = 0; g < a.length; ++g) {
            var h = a.codePointAt(g);
            if (127 >= h) {
              if (c >= d) break;
              b[c++] = h;
            } else if (2047 >= h) {
              if (c + 1 >= d) break;
              b[c++] = 192 | h >> 6;
              b[c++] = 128 | h & 63;
            } else if (65535 >= h) {
              if (c + 2 >= d) break;
              b[c++] = 224 | h >> 12;
              b[c++] = 128 | h >> 6 & 63;
              b[c++] = 128 | h & 63;
            } else {
              if (c + 3 >= d) break;
              b[c++] = 240 | h >> 18;
              b[c++] = 128 | h >> 12 & 63;
              b[c++] = 128 | h >> 6 & 63;
              b[c++] = 128 | h & 63;
              g++;
            }
          }
          b[c] = 0;
          return c - e;
        }, jb = [];
        function kb(a, b) {
          jb[a] = { input: [], output: [], eb: b };
          mb(a, nb);
        }
        var nb = { open(a) {
          var b = jb[a.node.rdev];
          if (!b) throw new N(43);
          a.tty = b;
          a.seekable = false;
        }, close(a) {
          a.tty.eb.fsync(a.tty);
        }, fsync(a) {
          a.tty.eb.fsync(a.tty);
        }, read(a, b, c, d) {
          if (!a.tty || !a.tty.eb.Bb) throw new N(60);
          for (var e = 0, g = 0; g < d; g++) {
            try {
              var h = a.tty.eb.Bb(a.tty);
            } catch (q) {
              throw new N(29);
            }
            if (void 0 === h && 0 === e) throw new N(6);
            if (null === h || void 0 === h) break;
            e++;
            b[c + g] = h;
          }
          e && (a.node.atime = Date.now());
          return e;
        }, write(a, b, c, d) {
          if (!a.tty || !a.tty.eb.ub) throw new N(60);
          try {
            for (var e = 0; e < d; e++) a.tty.eb.ub(a.tty, b[c + e]);
          } catch (g) {
            throw new N(29);
          }
          d && (a.node.mtime = a.node.ctime = Date.now());
          return e;
        } }, wb = { Bb() {
          a: {
            if (!hb.length) {
              var a = null;
              if (ca) {
                var b = Buffer.alloc(256), c = 0, d = process.stdin.fd;
                try {
                  c = fs5.readSync(d, b, 0, 256);
                } catch (e) {
                  if (e.toString().includes("EOF")) c = 0;
                  else throw e;
                }
                0 < c && (a = b.slice(0, c).toString("utf-8"));
              } else globalThis.window?.prompt && (a = window.prompt("Input: "), null !== a && (a += "\n"));
              if (!a) {
                a = null;
                break a;
              }
              b = Array(ib(a) + 1);
              a = M(a, b, 0, b.length);
              b.length = a;
              hb = b;
            }
            a = hb.shift();
          }
          return a;
        }, ub(a, b) {
          null === b || 10 === b ? (Ea(gb(a.output)), a.output = []) : 0 != b && a.output.push(b);
        }, fsync(a) {
          0 < a.output?.length && (Ea(gb(a.output)), a.output = []);
        }, hc() {
          return { bc: 25856, dc: 5, ac: 191, cc: 35387, $b: [3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
        }, ic() {
          return 0;
        }, jc() {
          return [24, 80];
        } }, xb = { ub(a, b) {
          null === b || 10 === b ? (B(gb(a.output)), a.output = []) : 0 != b && a.output.push(b);
        }, fsync(a) {
          0 < a.output?.length && (B(gb(a.output)), a.output = []);
        } }, O = { Wa: null, Xa() {
          return O.createNode(null, "/", 16895, 0);
        }, createNode(a, b, c, d) {
          if (24576 === (c & 61440) || 4096 === (c & 61440)) throw new N(63);
          O.Wa || (O.Wa = { dir: { node: { Ta: O.La.Ta, Ua: O.La.Ua, lookup: O.La.lookup, ib: O.La.ib, rename: O.La.rename, unlink: O.La.unlink, rmdir: O.La.rmdir, readdir: O.La.readdir, symlink: O.La.symlink }, stream: { Va: O.Ma.Va } }, file: { node: { Ta: O.La.Ta, Ua: O.La.Ua }, stream: { Va: O.Ma.Va, read: O.Ma.read, write: O.Ma.write, jb: O.Ma.jb, kb: O.Ma.kb } }, link: { node: { Ta: O.La.Ta, Ua: O.La.Ua, readlink: O.La.readlink }, stream: {} }, yb: { node: { Ta: O.La.Ta, Ua: O.La.Ua }, stream: yb } });
          c = zb(a, b, c, d);
          P(c.mode) ? (c.La = O.Wa.dir.node, c.Ma = O.Wa.dir.stream, c.Na = {}) : 32768 === (c.mode & 61440) ? (c.La = O.Wa.file.node, c.Ma = O.Wa.file.stream, c.Ra = 0, c.Na = null) : 40960 === (c.mode & 61440) ? (c.La = O.Wa.link.node, c.Ma = O.Wa.link.stream) : 8192 === (c.mode & 61440) && (c.La = O.Wa.yb.node, c.Ma = O.Wa.yb.stream);
          c.atime = c.mtime = c.ctime = Date.now();
          a && (a.Na[b] = c, a.atime = a.mtime = a.ctime = c.atime);
          return c;
        }, fc(a) {
          return a.Na ? a.Na.subarray ? a.Na.subarray(0, a.Ra) : new Uint8Array(a.Na) : new Uint8Array(0);
        }, La: {
          Ta(a) {
            var b = {};
            b.dev = 8192 === (a.mode & 61440) ? a.id : 1;
            b.ino = a.id;
            b.mode = a.mode;
            b.nlink = 1;
            b.uid = 0;
            b.gid = 0;
            b.rdev = a.rdev;
            P(a.mode) ? b.size = 4096 : 32768 === (a.mode & 61440) ? b.size = a.Ra : 40960 === (a.mode & 61440) ? b.size = a.link.length : b.size = 0;
            b.atime = new Date(a.atime);
            b.mtime = new Date(a.mtime);
            b.ctime = new Date(a.ctime);
            b.blksize = 4096;
            b.blocks = Math.ceil(b.size / b.blksize);
            return b;
          },
          Ua(a, b) {
            for (var c of ["mode", "atime", "mtime", "ctime"]) null != b[c] && (a[c] = b[c]);
            void 0 !== b.size && (b = b.size, a.Ra != b && (0 == b ? (a.Na = null, a.Ra = 0) : (c = a.Na, a.Na = new Uint8Array(b), c && a.Na.set(c.subarray(0, Math.min(b, a.Ra))), a.Ra = b)));
          },
          lookup() {
            O.nb || (O.nb = new N(44), O.nb.stack = "<generic error, no stack>");
            throw O.nb;
          },
          ib(a, b, c, d) {
            return O.createNode(a, b, c, d);
          },
          rename(a, b, c) {
            try {
              var d = Q(b, c);
            } catch (g) {
            }
            if (d) {
              if (P(a.mode)) for (var e in d.Na) throw new N(55);
              Ab(d);
            }
            delete a.parent.Na[a.name];
            b.Na[c] = a;
            a.name = c;
            b.ctime = b.mtime = a.parent.ctime = a.parent.mtime = Date.now();
          },
          unlink(a, b) {
            delete a.Na[b];
            a.ctime = a.mtime = Date.now();
          },
          rmdir(a, b) {
            var c = Q(a, b), d;
            for (d in c.Na) throw new N(55);
            delete a.Na[b];
            a.ctime = a.mtime = Date.now();
          },
          readdir(a) {
            return [".", "..", ...Object.keys(a.Na)];
          },
          symlink(a, b, c) {
            a = O.createNode(a, b, 41471, 0);
            a.link = c;
            return a;
          },
          readlink(a) {
            if (40960 !== (a.mode & 61440)) throw new N(28);
            return a.link;
          }
        }, Ma: { read(a, b, c, d, e) {
          var g = a.node.Na;
          if (e >= a.node.Ra) return 0;
          a = Math.min(a.node.Ra - e, d);
          if (8 < a && g.subarray) b.set(g.subarray(e, e + a), c);
          else for (d = 0; d < a; d++) b[c + d] = g[e + d];
          return a;
        }, write(a, b, c, d, e, g) {
          b.buffer === m.buffer && (g = false);
          if (!d) return 0;
          a = a.node;
          a.mtime = a.ctime = Date.now();
          if (b.subarray && (!a.Na || a.Na.subarray)) {
            if (g) return a.Na = b.subarray(c, c + d), a.Ra = d;
            if (0 === a.Ra && 0 === e) return a.Na = b.slice(c, c + d), a.Ra = d;
            if (e + d <= a.Ra) return a.Na.set(b.subarray(c, c + d), e), d;
          }
          g = e + d;
          var h = a.Na ? a.Na.length : 0;
          h >= g || (g = Math.max(g, h * (1048576 > h ? 2 : 1.125) >>> 0), 0 != h && (g = Math.max(g, 256)), h = a.Na, a.Na = new Uint8Array(g), 0 < a.Ra && a.Na.set(h.subarray(0, a.Ra), 0));
          if (a.Na.subarray && b.subarray) a.Na.set(b.subarray(c, c + d), e);
          else for (g = 0; g < d; g++) a.Na[e + g] = b[c + g];
          a.Ra = Math.max(a.Ra, e + d);
          return d;
        }, Va(a, b, c) {
          1 === c ? b += a.position : 2 === c && 32768 === (a.node.mode & 61440) && (b += a.node.Ra);
          if (0 > b) throw new N(28);
          return b;
        }, jb(a, b, c, d, e) {
          if (32768 !== (a.node.mode & 61440)) throw new N(43);
          a = a.node.Na;
          if (e & 2 || !a || a.buffer !== m.buffer) {
            e = true;
            d = 65536 * Math.ceil(b / 65536);
            var g = Bb(65536, d);
            g && C.fill(0, g, g + d);
            d = g;
            if (!d) throw new N(48);
            if (a) {
              if (0 < c || c + b < a.length) a.subarray ? a = a.subarray(c, c + b) : a = Array.prototype.slice.call(a, c, c + b);
              m.set(a, d);
            }
          } else e = false, d = a.byteOffset;
          return { Xb: d, Eb: e };
        }, kb(a, b, c, d) {
          O.Ma.write(a, b, 0, d, c, false);
          return 0;
        } } }, ja = (a, b) => {
          var c = 0;
          a && (c |= 365);
          b && (c |= 146);
          return c;
        }, Cb = null, Db = {}, Eb = [], Fb = 1, R = null, Gb = false, Hb = true, Ib = {}, N = class {
          name = "ErrnoError";
          constructor(a) {
            this.Pa = a;
          }
        }, Jb = class {
          hb = {};
          node = null;
          get flags() {
            return this.hb.flags;
          }
          set flags(a) {
            this.hb.flags = a;
          }
          get position() {
            return this.hb.position;
          }
          set position(a) {
            this.hb.position = a;
          }
        }, Kb = class {
          La = {};
          Ma = {};
          bb = null;
          constructor(a, b, c, d) {
            a ||= this;
            this.parent = a;
            this.Xa = a.Xa;
            this.id = Fb++;
            this.name = b;
            this.mode = c;
            this.rdev = d;
            this.atime = this.mtime = this.ctime = Date.now();
          }
          get read() {
            return 365 === (this.mode & 365);
          }
          set read(a) {
            a ? this.mode |= 365 : this.mode &= -366;
          }
          get write() {
            return 146 === (this.mode & 146);
          }
          set write(a) {
            a ? this.mode |= 146 : this.mode &= -147;
          }
        };
        function S(a, b = {}) {
          if (!a) throw new N(44);
          b.pb ?? (b.pb = true);
          "/" === a.charAt(0) || (a = "//" + a);
          var c = 0;
          a: for (; 40 > c; c++) {
            a = a.split("/").filter((q) => !!q);
            for (var d = Cb, e = "/", g = 0; g < a.length; g++) {
              var h = g === a.length - 1;
              if (h && b.parent) break;
              if ("." !== a[g]) if (".." === a[g]) if (e = bb(e), d === d.parent) {
                a = e + "/" + a.slice(g + 1).join("/");
                c--;
                continue a;
              } else d = d.parent;
              else {
                e = ia(e + "/" + a[g]);
                try {
                  d = Q(d, a[g]);
                } catch (q) {
                  if (44 === q?.Pa && h && b.Wb) return { path: e };
                  throw q;
                }
                !d.bb || h && !b.pb || (d = d.bb.root);
                if (40960 === (d.mode & 61440) && (!h || b.ab)) {
                  if (!d.La.readlink) throw new N(52);
                  d = d.La.readlink(d);
                  "/" === d.charAt(0) || (d = bb(e) + "/" + d);
                  a = d + "/" + a.slice(g + 1).join("/");
                  continue a;
                }
              }
            }
            return { path: e, node: d };
          }
          throw new N(32);
        }
        function ha(a) {
          for (var b; ; ) {
            if (a === a.parent) return a = a.Xa.Db, b ? "/" !== a[a.length - 1] ? `${a}/${b}` : a + b : a;
            b = b ? `${a.name}/${b}` : a.name;
            a = a.parent;
          }
        }
        function Lb(a, b) {
          for (var c = 0, d = 0; d < b.length; d++) c = (c << 5) - c + b.charCodeAt(d) | 0;
          return (a + c >>> 0) % R.length;
        }
        function Ab(a) {
          var b = Lb(a.parent.id, a.name);
          if (R[b] === a) R[b] = a.cb;
          else for (b = R[b]; b; ) {
            if (b.cb === a) {
              b.cb = a.cb;
              break;
            }
            b = b.cb;
          }
        }
        function Q(a, b) {
          var c = P(a.mode) ? (c = Mb(a, "x")) ? c : a.La.lookup ? 0 : 2 : 54;
          if (c) throw new N(c);
          for (c = R[Lb(a.id, b)]; c; c = c.cb) {
            var d = c.name;
            if (c.parent.id === a.id && d === b) return c;
          }
          return a.La.lookup(a, b);
        }
        function zb(a, b, c, d) {
          a = new Kb(a, b, c, d);
          b = Lb(a.parent.id, a.name);
          a.cb = R[b];
          return R[b] = a;
        }
        function P(a) {
          return 16384 === (a & 61440);
        }
        function Nb(a) {
          var b = ["r", "w", "rw"][a & 3];
          a & 512 && (b += "w");
          return b;
        }
        function Mb(a, b) {
          if (Hb) return 0;
          if (!b.includes("r") || a.mode & 292) {
            if (b.includes("w") && !(a.mode & 146) || b.includes("x") && !(a.mode & 73)) return 2;
          } else return 2;
          return 0;
        }
        function Ob(a, b) {
          if (!P(a.mode)) return 54;
          try {
            return Q(a, b), 20;
          } catch (c) {
          }
          return Mb(a, "wx");
        }
        function Pb(a, b, c) {
          try {
            var d = Q(a, b);
          } catch (e) {
            return e.Pa;
          }
          if (a = Mb(a, "wx")) return a;
          if (c) {
            if (!P(d.mode)) return 54;
            if (d === d.parent || "/" === ha(d)) return 10;
          } else if (P(d.mode)) return 31;
          return 0;
        }
        function Qb(a) {
          if (!a) throw new N(63);
          return a;
        }
        function T(a) {
          a = Eb[a];
          if (!a) throw new N(8);
          return a;
        }
        function Rb(a, b = -1) {
          a = Object.assign(new Jb(), a);
          if (-1 == b) a: {
            for (b = 0; 4096 >= b; b++) if (!Eb[b]) break a;
            throw new N(33);
          }
          a.fd = b;
          return Eb[b] = a;
        }
        function Sb(a, b = -1) {
          a = Rb(a, b);
          a.Ma?.ec?.(a);
          return a;
        }
        function Tb(a, b, c) {
          var d = a?.Ma.Ua;
          a = d ? a : b;
          d ??= b.La.Ua;
          Qb(d);
          d(a, c);
        }
        var yb = { open(a) {
          a.Ma = Db[a.node.rdev].Ma;
          a.Ma.open?.(a);
        }, Va() {
          throw new N(70);
        } };
        function mb(a, b) {
          Db[a] = { Ma: b };
        }
        function Ub(a, b) {
          var c = "/" === b;
          if (c && Cb) throw new N(10);
          if (!c && b) {
            var d = S(b, { pb: false });
            b = d.path;
            d = d.node;
            if (d.bb) throw new N(10);
            if (!P(d.mode)) throw new N(54);
          }
          b = { type: a, kc: {}, Db: b, Vb: [] };
          a = a.Xa(b);
          a.Xa = b;
          b.root = a;
          c ? Cb = a : d && (d.bb = b, d.Xa && d.Xa.Vb.push(b));
        }
        function Vb(a, b, c) {
          var d = S(a, { parent: true }).node;
          a = cb(a);
          if (!a) throw new N(28);
          if ("." === a || ".." === a) throw new N(20);
          var e = Ob(d, a);
          if (e) throw new N(e);
          if (!d.La.ib) throw new N(63);
          return d.La.ib(d, a, b, c);
        }
        function ka(a, b = 438) {
          return Vb(a, b & 4095 | 32768, 0);
        }
        function U(a, b = 511) {
          return Vb(a, b & 1023 | 16384, 0);
        }
        function Wb(a, b, c) {
          "undefined" == typeof c && (c = b, b = 438);
          Vb(a, b | 8192, c);
        }
        function Xb(a, b) {
          if (!fb(a)) throw new N(44);
          var c = S(b, { parent: true }).node;
          if (!c) throw new N(44);
          b = cb(b);
          var d = Ob(c, b);
          if (d) throw new N(d);
          if (!c.La.symlink) throw new N(63);
          c.La.symlink(c, b, a);
        }
        function Yb(a) {
          var b = S(a, { parent: true }).node;
          a = cb(a);
          var c = Q(b, a), d = Pb(b, a, true);
          if (d) throw new N(d);
          if (!b.La.rmdir) throw new N(63);
          if (c.bb) throw new N(10);
          b.La.rmdir(b, a);
          Ab(c);
        }
        function ua(a) {
          var b = S(a, { parent: true }).node;
          if (!b) throw new N(44);
          a = cb(a);
          var c = Q(b, a), d = Pb(b, a, false);
          if (d) throw new N(d);
          if (!b.La.unlink) throw new N(63);
          if (c.bb) throw new N(10);
          b.La.unlink(b, a);
          Ab(c);
        }
        function Zb(a, b) {
          a = S(a, { ab: !b }).node;
          return Qb(a.La.Ta)(a);
        }
        function $b(a, b, c, d) {
          Tb(a, b, { mode: c & 4095 | b.mode & -4096, ctime: Date.now(), Lb: d });
        }
        function ma(a, b) {
          a = "string" == typeof a ? S(a, { ab: true }).node : a;
          $b(null, a, b);
        }
        function ac(a, b, c) {
          if (P(b.mode)) throw new N(31);
          if (32768 !== (b.mode & 61440)) throw new N(28);
          var d = Mb(b, "w");
          if (d) throw new N(d);
          Tb(a, b, { size: c, timestamp: Date.now() });
        }
        function na(a, b, c = 438) {
          if ("" === a) throw new N(44);
          if ("string" == typeof b) {
            var d = { r: 0, "r+": 2, w: 577, "w+": 578, a: 1089, "a+": 1090 }[b];
            if ("undefined" == typeof d) throw Error(`Unknown file open mode: ${b}`);
            b = d;
          }
          c = b & 64 ? c & 4095 | 32768 : 0;
          if ("object" == typeof a) d = a;
          else {
            var e = a.endsWith("/");
            a = S(a, { ab: !(b & 131072), Wb: true });
            d = a.node;
            a = a.path;
          }
          var g = false;
          if (b & 64) if (d) {
            if (b & 128) throw new N(20);
          } else {
            if (e) throw new N(31);
            d = Vb(a, c | 511, 0);
            g = true;
          }
          if (!d) throw new N(44);
          8192 === (d.mode & 61440) && (b &= -513);
          if (b & 65536 && !P(d.mode)) throw new N(54);
          if (!g && (e = d ? 40960 === (d.mode & 61440) ? 32 : P(d.mode) && ("r" !== Nb(b) || b & 576) ? 31 : Mb(d, Nb(b)) : 44)) throw new N(e);
          b & 512 && !g && (e = d, e = "string" == typeof e ? S(e, { ab: true }).node : e, ac(null, e, 0));
          b &= -131713;
          e = Rb({ node: d, path: ha(d), flags: b, seekable: true, position: 0, Ma: d.Ma, Yb: [], error: false });
          e.Ma.open && e.Ma.open(e);
          g && ma(d, c & 511);
          !k.logReadFiles || b & 1 || a in Ib || (Ib[a] = 1);
          return e;
        }
        function pa(a) {
          if (null === a.fd) throw new N(8);
          a.rb && (a.rb = null);
          try {
            a.Ma.close && a.Ma.close(a);
          } catch (b) {
            throw b;
          } finally {
            Eb[a.fd] = null;
          }
          a.fd = null;
        }
        function bc(a, b, c) {
          if (null === a.fd) throw new N(8);
          if (!a.seekable || !a.Ma.Va) throw new N(70);
          if (0 != c && 1 != c && 2 != c) throw new N(28);
          a.position = a.Ma.Va(a, b, c);
          a.Yb = [];
        }
        function cc(a, b, c, d, e) {
          if (0 > d || 0 > e) throw new N(28);
          if (null === a.fd) throw new N(8);
          if (1 === (a.flags & 2097155)) throw new N(8);
          if (P(a.node.mode)) throw new N(31);
          if (!a.Ma.read) throw new N(28);
          var g = "undefined" != typeof e;
          if (!g) e = a.position;
          else if (!a.seekable) throw new N(70);
          b = a.Ma.read(a, b, c, d, e);
          g || (a.position += b);
          return b;
        }
        function oa(a, b, c, d, e) {
          if (0 > d || 0 > e) throw new N(28);
          if (null === a.fd) throw new N(8);
          if (0 === (a.flags & 2097155)) throw new N(8);
          if (P(a.node.mode)) throw new N(31);
          if (!a.Ma.write) throw new N(28);
          a.seekable && a.flags & 1024 && bc(a, 0, 2);
          var g = "undefined" != typeof e;
          if (!g) e = a.position;
          else if (!a.seekable) throw new N(70);
          b = a.Ma.write(a, b, c, d, e, void 0);
          g || (a.position += b);
          return b;
        }
        function ta(a) {
          var b = b || 0;
          var c = "binary";
          "utf8" !== c && "binary" !== c && Na(`Invalid encoding type "${c}"`);
          b = na(a, b);
          a = Zb(a).size;
          var d = new Uint8Array(a);
          cc(b, d, 0, a, 0);
          "utf8" === c && (d = gb(d));
          pa(b);
          return d;
        }
        function W(a, b, c) {
          a = ia("/dev/" + a);
          var d = ja(!!b, !!c);
          W.Cb ?? (W.Cb = 64);
          var e = W.Cb++ << 8 | 0;
          mb(e, { open(g) {
            g.seekable = false;
          }, close() {
            c?.buffer?.length && c(10);
          }, read(g, h, q, v) {
            for (var u = 0, x = 0; x < v; x++) {
              try {
                var D = b();
              } catch (pb) {
                throw new N(29);
              }
              if (void 0 === D && 0 === u) throw new N(6);
              if (null === D || void 0 === D) break;
              u++;
              h[q + x] = D;
            }
            u && (g.node.atime = Date.now());
            return u;
          }, write(g, h, q, v) {
            for (var u = 0; u < v; u++) try {
              c(h[q + u]);
            } catch (x) {
              throw new N(29);
            }
            v && (g.node.mtime = g.node.ctime = Date.now());
            return u;
          } });
          Wb(a, d, e);
        }
        var X = {};
        function Y(a, b, c) {
          if ("/" === b.charAt(0)) return b;
          a = -100 === a ? "/" : T(a).path;
          if (0 == b.length) {
            if (!c) throw new N(44);
            return a;
          }
          return a + "/" + b;
        }
        function mc(a, b) {
          F[a >> 2] = b.dev;
          F[a + 4 >> 2] = b.mode;
          F[a + 8 >> 2] = b.nlink;
          F[a + 12 >> 2] = b.uid;
          F[a + 16 >> 2] = b.gid;
          F[a + 20 >> 2] = b.rdev;
          H[a + 24 >> 3] = BigInt(b.size);
          E[a + 32 >> 2] = 4096;
          E[a + 36 >> 2] = b.blocks;
          var c = b.atime.getTime(), d = b.mtime.getTime(), e = b.ctime.getTime();
          H[a + 40 >> 3] = BigInt(Math.floor(c / 1e3));
          F[a + 48 >> 2] = c % 1e3 * 1e6;
          H[a + 56 >> 3] = BigInt(Math.floor(d / 1e3));
          F[a + 64 >> 2] = d % 1e3 * 1e6;
          H[a + 72 >> 3] = BigInt(Math.floor(e / 1e3));
          F[a + 80 >> 2] = e % 1e3 * 1e6;
          H[a + 88 >> 3] = BigInt(b.ino);
          return 0;
        }
        var Ec = void 0, Gc = () => {
          var a = E[+Ec >> 2];
          Ec += 4;
          return a;
        }, Hc = 0, Ic = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335], Jc = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], Kc = {}, Lc = (a) => {
          Ha = a;
          Ya || 0 < Hc || (k.onExit?.(a), Ga = true);
          ya(a, new Sa(a));
        }, Mc = (a) => {
          if (!Ga) try {
            a();
          } catch (b) {
            b instanceof Sa || "unwind" == b || ya(1, b);
          } finally {
            if (!(Ya || 0 < Hc)) try {
              Ha = a = Ha, Lc(a);
            } catch (b) {
              b instanceof Sa || "unwind" == b || ya(1, b);
            }
          }
        }, Nc = {}, Pc = () => {
          if (!Oc) {
            var a = { USER: "web_user", LOGNAME: "web_user", PATH: "/", PWD: "/", HOME: "/home/web_user", LANG: (globalThis.navigator?.language ?? "C").replace("-", "_") + ".UTF-8", _: xa || "./this.program" }, b;
            for (b in Nc) void 0 === Nc[b] ? delete a[b] : a[b] = Nc[b];
            var c = [];
            for (b in a) c.push(`${b}=${a[b]}`);
            Oc = c;
          }
          return Oc;
        }, Oc, Qc = (a, b, c, d) => {
          var e = { string: (u) => {
            var x = 0;
            if (null !== u && void 0 !== u && 0 !== u) {
              x = ib(u) + 1;
              var D = y(x);
              M(u, C, D, x);
              x = D;
            }
            return x;
          }, array: (u) => {
            var x = y(u.length);
            m.set(u, x);
            return x;
          } };
          a = k["_" + a];
          var g = [], h = 0;
          if (d) for (var q = 0; q < d.length; q++) {
            var v = e[c[q]];
            v ? (0 === h && (h = qa()), g[q] = v(d[q])) : g[q] = d[q];
          }
          c = a(...g);
          return c = (function(u) {
            0 !== h && sa(h);
            return "string" === b ? z(u) : "boolean" === b ? !!u : u;
          })(c);
        }, fa = (a) => {
          var b = ib(a) + 1, c = da(b);
          c && M(a, C, c, b);
          return c;
        }, Rc, Sc = [], A = (a) => {
          Rc.delete(Z.get(a));
          Z.set(a, null);
          Sc.push(a);
        }, Tc = (a) => {
          const b = a.length;
          return [b % 128 | 128, b >> 7, ...a];
        }, Uc = { i: 127, p: 127, j: 126, f: 125, d: 124, e: 111 }, Vc = (a) => Tc(Array.from(a, (b) => Uc[b])), wa = (a, b) => {
          if (!Rc) {
            Rc = /* @__PURE__ */ new WeakMap();
            var c = Z.length;
            if (Rc) for (var d = 0; d < 0 + c; d++) {
              var e = Z.get(d);
              e && Rc.set(e, d);
            }
          }
          if (c = Rc.get(a) || 0) return c;
          c = Sc.length ? Sc.pop() : Z.grow(1);
          try {
            Z.set(c, a);
          } catch (g) {
            if (!(g instanceof TypeError)) throw g;
            b = Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0, 1, ...Tc([1, 96, ...Vc(b.slice(1)), ...Vc("v" === b[0] ? "" : b[0])]), 2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
            b = new WebAssembly.Module(b);
            b = new WebAssembly.Instance(b, { e: { f: a } }).exports.f;
            Z.set(c, b);
          }
          Rc.set(a, c);
          return c;
        };
        R = Array(4096);
        Ub(O, "/");
        U("/tmp");
        U("/home");
        U("/home/web_user");
        (function() {
          U("/dev");
          mb(259, { read: () => 0, write: (d, e, g, h) => h, Va: () => 0 });
          Wb("/dev/null", 259);
          kb(1280, wb);
          kb(1536, xb);
          Wb("/dev/tty", 1280);
          Wb("/dev/tty1", 1536);
          var a = new Uint8Array(1024), b = 0, c = () => {
            0 === b && (eb(a), b = a.byteLength);
            return a[--b];
          };
          W("random", c);
          W("urandom", c);
          U("/dev/shm");
          U("/dev/shm/tmp");
        })();
        (function() {
          U("/proc");
          var a = U("/proc/self");
          U("/proc/self/fd");
          Ub({ Xa() {
            var b = zb(a, "fd", 16895, 73);
            b.Ma = { Va: O.Ma.Va };
            b.La = { lookup(c, d) {
              c = +d;
              var e = T(c);
              c = { parent: null, Xa: { Db: "fake" }, La: { readlink: () => e.path }, id: c + 1 };
              return c.parent = c;
            }, readdir() {
              return Array.from(Eb.entries()).filter(([, c]) => c).map(([c]) => c.toString());
            } };
            return b;
          } }, "/proc/self/fd");
        })();
        k.noExitRuntime && (Ya = k.noExitRuntime);
        k.print && (Ea = k.print);
        k.printErr && (B = k.printErr);
        k.wasmBinary && (Fa = k.wasmBinary);
        k.thisProgram && (xa = k.thisProgram);
        if (k.preInit) for ("function" == typeof k.preInit && (k.preInit = [k.preInit]); 0 < k.preInit.length; ) k.preInit.shift()();
        k.stackSave = () => qa();
        k.stackRestore = (a) => sa(a);
        k.stackAlloc = (a) => y(a);
        k.cwrap = (a, b, c, d) => {
          var e = !c || c.every((g) => "number" === g || "boolean" === g);
          return "string" !== b && e && !d ? k["_" + a] : (...g) => Qc(a, b, c, g);
        };
        k.addFunction = wa;
        k.removeFunction = A;
        k.UTF8ToString = z;
        k.stringToNewUTF8 = fa;
        k.writeArrayToMemory = (a, b) => {
          m.set(a, b);
        };
        var da, ea, Bb, Wc, sa, y, qa, Ma, Z, Xc = {
          a: (a, b, c, d) => Na(`Assertion failed: ${z(a)}, at: ` + [b ? z(b) : "unknown filename", c, d ? z(d) : "unknown function"]),
          i: function(a, b) {
            try {
              return a = z(a), ma(a, b), 0;
            } catch (c) {
              if ("undefined" == typeof X || "ErrnoError" !== c.name) throw c;
              return -c.Pa;
            }
          },
          L: function(a, b, c) {
            try {
              b = z(b);
              b = Y(a, b);
              if (c & -8) return -28;
              var d = S(b, { ab: true }).node;
              if (!d) return -44;
              a = "";
              c & 4 && (a += "r");
              c & 2 && (a += "w");
              c & 1 && (a += "x");
              return a && Mb(d, a) ? -2 : 0;
            } catch (e) {
              if ("undefined" == typeof X || "ErrnoError" !== e.name) throw e;
              return -e.Pa;
            }
          },
          j: function(a, b) {
            try {
              var c = T(a);
              $b(c, c.node, b, false);
              return 0;
            } catch (d) {
              if ("undefined" == typeof X || "ErrnoError" !== d.name) throw d;
              return -d.Pa;
            }
          },
          h: function(a) {
            try {
              var b = T(a);
              Tb(b, b.node, { timestamp: Date.now(), Lb: false });
              return 0;
            } catch (c) {
              if ("undefined" == typeof X || "ErrnoError" !== c.name) throw c;
              return -c.Pa;
            }
          },
          b: function(a, b, c) {
            Ec = c;
            try {
              var d = T(a);
              switch (b) {
                case 0:
                  var e = Gc();
                  if (0 > e) break;
                  for (; Eb[e]; ) e++;
                  return Sb(d, e).fd;
                case 1:
                case 2:
                  return 0;
                case 3:
                  return d.flags;
                case 4:
                  return e = Gc(), d.flags |= e, 0;
                case 12:
                  return e = Gc(), Ia[e + 0 >> 1] = 2, 0;
                case 13:
                case 14:
                  return 0;
              }
              return -28;
            } catch (g) {
              if ("undefined" == typeof X || "ErrnoError" !== g.name) throw g;
              return -g.Pa;
            }
          },
          g: function(a, b) {
            try {
              var c = T(a), d = c.node, e = c.Ma.Ta;
              a = e ? c : d;
              e ??= d.La.Ta;
              Qb(e);
              var g = e(a);
              return mc(b, g);
            } catch (h) {
              if ("undefined" == typeof X || "ErrnoError" !== h.name) throw h;
              return -h.Pa;
            }
          },
          H: function(a, b) {
            b = -9007199254740992 > b || 9007199254740992 < b ? NaN : Number(b);
            try {
              if (isNaN(b)) return -61;
              var c = T(a);
              if (0 > b || 0 === (c.flags & 2097155)) throw new N(28);
              ac(c, c.node, b);
              return 0;
            } catch (d) {
              if ("undefined" == typeof X || "ErrnoError" !== d.name) throw d;
              return -d.Pa;
            }
          },
          G: function(a, b) {
            try {
              if (0 === b) return -28;
              var c = ib("/") + 1;
              if (b < c) return -68;
              M("/", C, a, b);
              return c;
            } catch (d) {
              if ("undefined" == typeof X || "ErrnoError" !== d.name) throw d;
              return -d.Pa;
            }
          },
          K: function(a, b) {
            try {
              return a = z(a), mc(b, Zb(a, true));
            } catch (c) {
              if ("undefined" == typeof X || "ErrnoError" !== c.name) throw c;
              return -c.Pa;
            }
          },
          C: function(a, b, c) {
            try {
              return b = z(b), b = Y(a, b), U(b, c), 0;
            } catch (d) {
              if ("undefined" == typeof X || "ErrnoError" !== d.name) throw d;
              return -d.Pa;
            }
          },
          J: function(a, b, c, d) {
            try {
              b = z(b);
              var e = d & 256;
              b = Y(a, b, d & 4096);
              return mc(c, e ? Zb(b, true) : Zb(b));
            } catch (g) {
              if ("undefined" == typeof X || "ErrnoError" !== g.name) throw g;
              return -g.Pa;
            }
          },
          x: function(a, b, c, d) {
            Ec = d;
            try {
              b = z(b);
              b = Y(a, b);
              var e = d ? Gc() : 0;
              return na(b, c, e).fd;
            } catch (g) {
              if ("undefined" == typeof X || "ErrnoError" !== g.name) throw g;
              return -g.Pa;
            }
          },
          v: function(a, b, c, d) {
            try {
              b = z(b);
              b = Y(a, b);
              if (0 >= d) return -28;
              var e = S(b).node;
              if (!e) throw new N(44);
              if (!e.La.readlink) throw new N(28);
              var g = e.La.readlink(e);
              var h = Math.min(d, ib(g)), q = m[c + h];
              M(
                g,
                C,
                c,
                d + 1
              );
              m[c + h] = q;
              return h;
            } catch (v) {
              if ("undefined" == typeof X || "ErrnoError" !== v.name) throw v;
              return -v.Pa;
            }
          },
          u: function(a) {
            try {
              return a = z(a), Yb(a), 0;
            } catch (b) {
              if ("undefined" == typeof X || "ErrnoError" !== b.name) throw b;
              return -b.Pa;
            }
          },
          f: function(a, b) {
            try {
              return a = z(a), mc(b, Zb(a));
            } catch (c) {
              if ("undefined" == typeof X || "ErrnoError" !== c.name) throw c;
              return -c.Pa;
            }
          },
          r: function(a, b, c) {
            try {
              b = z(b);
              b = Y(a, b);
              if (c) if (512 === c) Yb(b);
              else return -28;
              else ua(b);
              return 0;
            } catch (d) {
              if ("undefined" == typeof X || "ErrnoError" !== d.name) throw d;
              return -d.Pa;
            }
          },
          q: function(a, b, c) {
            try {
              b = z(b);
              b = Y(a, b, true);
              var d = Date.now(), e, g;
              if (c) {
                var h = F[c >> 2] + 4294967296 * E[c + 4 >> 2], q = E[c + 8 >> 2];
                1073741823 == q ? e = d : 1073741822 == q ? e = null : e = 1e3 * h + q / 1e6;
                c += 16;
                h = F[c >> 2] + 4294967296 * E[c + 4 >> 2];
                q = E[c + 8 >> 2];
                1073741823 == q ? g = d : 1073741822 == q ? g = null : g = 1e3 * h + q / 1e6;
              } else g = e = d;
              if (null !== (g ?? e)) {
                a = e;
                var v = S(b, { ab: true }).node;
                Qb(v.La.Ua)(v, { atime: a, mtime: g });
              }
              return 0;
            } catch (u) {
              if ("undefined" == typeof X || "ErrnoError" !== u.name) throw u;
              return -u.Pa;
            }
          },
          m: () => Na(""),
          l: () => {
            Ya = false;
            Hc = 0;
          },
          A: function(a, b) {
            a = -9007199254740992 > a || 9007199254740992 < a ? NaN : Number(a);
            a = new Date(1e3 * a);
            E[b >> 2] = a.getSeconds();
            E[b + 4 >> 2] = a.getMinutes();
            E[b + 8 >> 2] = a.getHours();
            E[b + 12 >> 2] = a.getDate();
            E[b + 16 >> 2] = a.getMonth();
            E[b + 20 >> 2] = a.getFullYear() - 1900;
            E[b + 24 >> 2] = a.getDay();
            var c = a.getFullYear();
            E[b + 28 >> 2] = (0 !== c % 4 || 0 === c % 100 && 0 !== c % 400 ? Jc : Ic)[a.getMonth()] + a.getDate() - 1 | 0;
            E[b + 36 >> 2] = -(60 * a.getTimezoneOffset());
            c = new Date(a.getFullYear(), 6, 1).getTimezoneOffset();
            var d = new Date(a.getFullYear(), 0, 1).getTimezoneOffset();
            E[b + 32 >> 2] = (c != d && a.getTimezoneOffset() == Math.min(d, c)) | 0;
          },
          y: function(a, b, c, d, e, g, h) {
            e = -9007199254740992 > e || 9007199254740992 < e ? NaN : Number(e);
            try {
              var q = T(d);
              if (0 !== (b & 2) && 0 === (c & 2) && 2 !== (q.flags & 2097155)) throw new N(2);
              if (1 === (q.flags & 2097155)) throw new N(2);
              if (!q.Ma.jb) throw new N(43);
              if (!a) throw new N(28);
              var v = q.Ma.jb(q, a, e, b, c);
              var u = v.Xb;
              E[g >> 2] = v.Eb;
              F[h >> 2] = u;
              return 0;
            } catch (x) {
              if ("undefined" == typeof X || "ErrnoError" !== x.name) throw x;
              return -x.Pa;
            }
          },
          z: function(a, b, c, d, e, g) {
            g = -9007199254740992 > g || 9007199254740992 < g ? NaN : Number(g);
            try {
              var h = T(e);
              if (c & 2) {
                c = g;
                if (32768 !== (h.node.mode & 61440)) throw new N(43);
                if (!(d & 2)) {
                  var q = C.slice(a, a + b);
                  h.Ma.kb && h.Ma.kb(h, q, c, b, d);
                }
              }
            } catch (v) {
              if ("undefined" == typeof X || "ErrnoError" !== v.name) throw v;
              return -v.Pa;
            }
          },
          n: (a, b) => {
            Kc[a] && (clearTimeout(Kc[a].id), delete Kc[a]);
            if (!b) return 0;
            var c = setTimeout(() => {
              delete Kc[a];
              Mc(() => Wc(a, performance.now()));
            }, b);
            Kc[a] = { id: c, lc: b };
            return 0;
          },
          B: (a, b, c, d) => {
            var e = (/* @__PURE__ */ new Date()).getFullYear(), g = new Date(e, 0, 1).getTimezoneOffset();
            e = new Date(e, 6, 1).getTimezoneOffset();
            F[a >> 2] = 60 * Math.max(g, e);
            E[b >> 2] = Number(g != e);
            b = (h) => {
              var q = Math.abs(h);
              return `UTC${0 <= h ? "-" : "+"}${String(Math.floor(q / 60)).padStart(2, "0")}${String(q % 60).padStart(2, "0")}`;
            };
            a = b(g);
            b = b(e);
            e < g ? (M(a, C, c, 17), M(b, C, d, 17)) : (M(a, C, d, 17), M(b, C, c, 17));
          },
          d: () => Date.now(),
          s: () => 2147483648,
          c: () => performance.now(),
          o: (a) => {
            var b = C.length;
            a >>>= 0;
            if (2147483648 < a) return false;
            for (var c = 1; 4 >= c; c *= 2) {
              var d = b * (1 + 0.2 / c);
              d = Math.min(d, a + 100663296);
              a: {
                d = (Math.min(2147483648, 65536 * Math.ceil(Math.max(
                  a,
                  d
                ) / 65536)) - Ma.buffer.byteLength + 65535) / 65536 | 0;
                try {
                  Ma.grow(d);
                  La();
                  var e = 1;
                  break a;
                } catch (g) {
                }
                e = void 0;
              }
              if (e) return true;
            }
            return false;
          },
          E: (a, b) => {
            var c = 0, d = 0, e;
            for (e of Pc()) {
              var g = b + c;
              F[a + d >> 2] = g;
              c += M(e, C, g, Infinity) + 1;
              d += 4;
            }
            return 0;
          },
          F: (a, b) => {
            var c = Pc();
            F[a >> 2] = c.length;
            a = 0;
            for (var d of c) a += ib(d) + 1;
            F[b >> 2] = a;
            return 0;
          },
          e: function(a) {
            try {
              var b = T(a);
              pa(b);
              return 0;
            } catch (c) {
              if ("undefined" == typeof X || "ErrnoError" !== c.name) throw c;
              return c.Pa;
            }
          },
          p: function(a, b) {
            try {
              var c = T(a);
              m[b] = c.tty ? 2 : P(c.mode) ? 3 : 40960 === (c.mode & 61440) ? 7 : 4;
              Ia[b + 2 >> 1] = 0;
              H[b + 8 >> 3] = BigInt(0);
              H[b + 16 >> 3] = BigInt(0);
              return 0;
            } catch (d) {
              if ("undefined" == typeof X || "ErrnoError" !== d.name) throw d;
              return d.Pa;
            }
          },
          w: function(a, b, c, d) {
            try {
              a: {
                var e = T(a);
                a = b;
                for (var g, h = b = 0; h < c; h++) {
                  var q = F[a >> 2], v = F[a + 4 >> 2];
                  a += 8;
                  var u = cc(e, m, q, v, g);
                  if (0 > u) {
                    var x = -1;
                    break a;
                  }
                  b += u;
                  if (u < v) break;
                  "undefined" != typeof g && (g += u);
                }
                x = b;
              }
              F[d >> 2] = x;
              return 0;
            } catch (D) {
              if ("undefined" == typeof X || "ErrnoError" !== D.name) throw D;
              return D.Pa;
            }
          },
          D: function(a, b, c, d) {
            b = -9007199254740992 > b || 9007199254740992 < b ? NaN : Number(b);
            try {
              if (isNaN(b)) return 61;
              var e = T(a);
              bc(e, b, c);
              H[d >> 3] = BigInt(e.position);
              e.rb && 0 === b && 0 === c && (e.rb = null);
              return 0;
            } catch (g) {
              if ("undefined" == typeof X || "ErrnoError" !== g.name) throw g;
              return g.Pa;
            }
          },
          I: function(a) {
            try {
              var b = T(a);
              return b.Ma?.fsync?.(b);
            } catch (c) {
              if ("undefined" == typeof X || "ErrnoError" !== c.name) throw c;
              return c.Pa;
            }
          },
          t: function(a, b, c, d) {
            try {
              a: {
                var e = T(a);
                a = b;
                for (var g, h = b = 0; h < c; h++) {
                  var q = F[a >> 2], v = F[a + 4 >> 2];
                  a += 8;
                  var u = oa(e, m, q, v, g);
                  if (0 > u) {
                    var x = -1;
                    break a;
                  }
                  b += u;
                  if (u < v) break;
                  "undefined" != typeof g && (g += u);
                }
                x = b;
              }
              F[d >> 2] = x;
              return 0;
            } catch (D) {
              if ("undefined" == typeof X || "ErrnoError" !== D.name) throw D;
              return D.Pa;
            }
          },
          k: Lc
        };
        function Yc() {
          function a() {
            k.calledRun = true;
            if (!Ga) {
              if (!k.noFSInit && !Gb) {
                var b, c;
                Gb = true;
                b ??= k.stdin;
                c ??= k.stdout;
                d ??= k.stderr;
                b ? W("stdin", b) : Xb("/dev/tty", "/dev/stdin");
                c ? W("stdout", null, c) : Xb("/dev/tty", "/dev/stdout");
                d ? W("stderr", null, d) : Xb("/dev/tty1", "/dev/stderr");
                na("/dev/stdin", 0);
                na("/dev/stdout", 1);
                na("/dev/stderr", 1);
              }
              Zc.N();
              Hb = false;
              k.onRuntimeInitialized?.();
              if (k.postRun) for ("function" == typeof k.postRun && (k.postRun = [k.postRun]); k.postRun.length; ) {
                var d = k.postRun.shift();
                Ua.push(d);
              }
              Ta(Ua);
            }
          }
          if (0 < K) Xa = Yc;
          else {
            if (k.preRun) for ("function" == typeof k.preRun && (k.preRun = [k.preRun]); k.preRun.length; ) Wa();
            Ta(Va);
            0 < K ? Xa = Yc : k.setStatus ? (k.setStatus("Running..."), setTimeout(() => {
              setTimeout(() => k.setStatus(""), 1);
              a();
            }, 1)) : a();
          }
        }
        var Zc;
        (async function() {
          function a(c) {
            c = Zc = c.exports;
            k._sqlite3_free = c.P;
            k._sqlite3_value_text = c.Q;
            k._sqlite3_prepare_v2 = c.R;
            k._sqlite3_step = c.S;
            k._sqlite3_reset = c.T;
            k._sqlite3_exec = c.U;
            k._sqlite3_finalize = c.V;
            k._sqlite3_column_name = c.W;
            k._sqlite3_column_text = c.X;
            k._sqlite3_column_type = c.Y;
            k._sqlite3_errmsg = c.Z;
            k._sqlite3_clear_bindings = c._;
            k._sqlite3_value_blob = c.$;
            k._sqlite3_value_bytes = c.aa;
            k._sqlite3_value_double = c.ba;
            k._sqlite3_value_int = c.ca;
            k._sqlite3_value_type = c.da;
            k._sqlite3_result_blob = c.ea;
            k._sqlite3_result_double = c.fa;
            k._sqlite3_result_error = c.ga;
            k._sqlite3_result_int = c.ha;
            k._sqlite3_result_int64 = c.ia;
            k._sqlite3_result_null = c.ja;
            k._sqlite3_result_text = c.ka;
            k._sqlite3_aggregate_context = c.la;
            k._sqlite3_column_count = c.ma;
            k._sqlite3_data_count = c.na;
            k._sqlite3_column_blob = c.oa;
            k._sqlite3_column_bytes = c.pa;
            k._sqlite3_column_double = c.qa;
            k._sqlite3_bind_blob = c.ra;
            k._sqlite3_bind_double = c.sa;
            k._sqlite3_bind_int = c.ta;
            k._sqlite3_bind_text = c.ua;
            k._sqlite3_bind_parameter_index = c.va;
            k._sqlite3_sql = c.wa;
            k._sqlite3_normalized_sql = c.xa;
            k._sqlite3_changes = c.ya;
            k._sqlite3_close_v2 = c.za;
            k._sqlite3_create_function_v2 = c.Aa;
            k._sqlite3_update_hook = c.Ba;
            k._sqlite3_open = c.Ca;
            da = k._malloc = c.Da;
            ea = k._free = c.Ea;
            k._RegisterExtensionFunctions = c.Fa;
            Bb = c.Ga;
            Wc = c.Ha;
            sa = c.Ia;
            y = c.Ja;
            qa = c.Ka;
            Ma = c.M;
            Z = c.O;
            La();
            K--;
            k.monitorRunDependencies?.(K);
            0 == K && Xa && (c = Xa, Xa = null, c());
            return Zc;
          }
          K++;
          k.monitorRunDependencies?.(K);
          var b = { a: Xc };
          if (k.instantiateWasm) return new Promise((c) => {
            k.instantiateWasm(b, (d, e) => {
              c(a(d, e));
            });
          });
          Oa ??= k.locateFile ? k.locateFile("sql-wasm.wasm", Aa) : Aa + "sql-wasm.wasm";
          return a((await Ra(b)).instance);
        })();
        Yc();
        return Module;
      });
      return initSqlJsPromise;
    };
    if (typeof exports2 === "object" && typeof module2 === "object") {
      module2.exports = initSqlJs2;
      module2.exports.default = initSqlJs2;
    } else if (typeof define === "function" && define["amd"]) {
      define([], function() {
        return initSqlJs2;
      });
    } else if (typeof exports2 === "object") {
      exports2["Module"] = initSqlJs2;
    }
  }
});

// desktop/main/main.js
var import_electron4 = require("electron");
var import_fs4 = __toESM(require("fs"), 1);
var import_path4 = __toESM(require("path"), 1);
var import_url = require("url");

// desktop/main/db.js
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_electron = require("electron");
var import_sql = __toESM(require_sql_wasm(), 1);

// desktop/main/security.js
var import_crypto = __toESM(require("crypto"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
function getElectronSafeStorage() {
  try {
    const electron = globalThis?.process?.versions?.electron ? require("electron") : null;
    return electron?.safeStorage || null;
  } catch {
    return null;
  }
}
var ALGORITHM = "aes-256-gcm";
var IV_LENGTH = 12;
var AUTH_TAG_LENGTH = 16;
var cachedMasterKey = null;
function getOrCreateMasterKey(userDataPath) {
  if (cachedMasterKey) return cachedMasterKey;
  const keyFilePath = import_path.default.join(userDataPath, ".sec_key");
  const safeStorage = getElectronSafeStorage();
  if (import_fs.default.existsSync(keyFilePath)) {
    try {
      const encryptedKey = import_fs.default.readFileSync(keyFilePath);
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        const decryptedHex = safeStorage.decryptString(encryptedKey);
        cachedMasterKey = Buffer.from(decryptedHex, "hex");
        return cachedMasterKey;
      } else {
        cachedMasterKey = encryptedKey.subarray(0, 32);
        return cachedMasterKey;
      }
    } catch (err) {
      console.warn("[Security] Failed to decrypt master key via DPAPI, regenerating key:", err.message);
    }
  }
  cachedMasterKey = import_crypto.default.randomBytes(32);
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    try {
      const encryptedBuffer = safeStorage.encryptString(cachedMasterKey.toString("hex"));
      import_fs.default.writeFileSync(keyFilePath, encryptedBuffer);
    } catch (e) {
      console.error("[Security] Error saving encrypted master key:", e);
    }
  } else {
    import_fs.default.writeFileSync(keyFilePath, cachedMasterKey);
  }
  return cachedMasterKey;
}
function encryptBuffer(plainBuffer, key) {
  const iv = import_crypto.default.randomBytes(IV_LENGTH);
  const cipher = import_crypto.default.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}
function decryptBuffer(encBuffer, key) {
  if (encBuffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Encrypted buffer is too short or corrupted");
  }
  const iv = encBuffer.subarray(0, IV_LENGTH);
  const tag = encBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = import_crypto.default.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
function encryptSensitiveString(str) {
  if (!str) return "";
  try {
    const safeStorage = getElectronSafeStorage();
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(str).toString("base64");
    }
  } catch (err) {
    console.error("[Security] safeStorage encrypt string failed:", err);
  }
  return str;
}
function decryptSensitiveString(encStr) {
  if (!encStr) return "";
  try {
    const safeStorage = getElectronSafeStorage();
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encStr, "base64");
      return safeStorage.decryptString(buffer);
    }
  } catch {
    return encStr;
  }
  return encStr;
}
function computeOpHash(key, { sequenceId, clientOpId, entityType, action, payload, prevHash }) {
  const hmac = import_crypto.default.createHmac("sha256", key);
  hmac.update(String(sequenceId || 0));
  hmac.update(String(clientOpId || ""));
  hmac.update(String(entityType || ""));
  hmac.update(String(action || ""));
  hmac.update(typeof payload === "string" ? payload : JSON.stringify(payload));
  hmac.update(String(prevHash || "ROOT_GENESIS"));
  return hmac.digest("hex");
}

// desktop/main/db.js
var dbInstance = null;
var dbFilePath = null;
var masterKey = null;
var userDataDir = null;
async function initDatabase(userDataPath) {
  if (dbInstance) return dbInstance;
  userDataDir = userDataPath;
  dbFilePath = import_path2.default.join(userDataPath, "elfishawy_offline.sqlite");
  masterKey = getOrCreateMasterKey(userDataPath);
  const SQL = await (0, import_sql.default)({
    // In production sql.js runs from app.asar, while electron-builder unpacks
    // the WASM binary beside it under app.asar.unpacked.
    locateFile: (file) => import_electron.app.isPackaged ? import_path2.default.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "sql.js", "dist", file) : import_path2.default.join(import_electron.app.getAppPath(), "node_modules", "sql.js", "dist", file)
  });
  let fileBuffer = null;
  if (import_fs2.default.existsSync(dbFilePath)) {
    try {
      const rawDiskBuffer = import_fs2.default.readFileSync(dbFilePath);
      const isPlaintext = rawDiskBuffer.length >= 16 && rawDiskBuffer.subarray(0, 16).toString("utf8").startsWith("SQLite format 3");
      if (isPlaintext) {
        console.log("[DB Security] Legacy plaintext SQLite detected. Creating migration backup...");
        const backupMigrationPath = import_path2.default.join(userDataPath, `elfishawy_offline_migration_${Date.now()}.sqlite.bak`);
        try {
          import_fs2.default.copyFileSync(dbFilePath, backupMigrationPath);
        } catch (bErr) {
          console.warn("[DB Security] Migration backup warning:", bErr.message);
        }
        fileBuffer = rawDiskBuffer;
      } else {
        try {
          fileBuffer = decryptBuffer(rawDiskBuffer, masterKey);
          console.log("[DB Security] Encrypted SQLite decrypted successfully in RAM.");
        } catch (decErr) {
          console.error("[DB Security] Decryption failed! Attempting recovery from latest valid backup:", decErr.message);
          fileBuffer = attemptBackupRecovery(userDataPath, masterKey);
        }
      }
    } catch (e) {
      console.error("Failed to read existing SQLite file:", e);
    }
  }
  dbInstance = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();
  runMigrations(dbInstance);
  saveDatabase();
  console.log("\u2705 SQLite initialized and encrypted securely at:", dbFilePath);
  return dbInstance;
}
function saveDatabase() {
  if (!dbInstance || !dbFilePath || !masterKey) return;
  try {
    const rawData = dbInstance.export();
    const plainBuffer = Buffer.from(rawData);
    const encryptedBuffer = encryptBuffer(plainBuffer, masterKey);
    const tmpFilePath = `${dbFilePath}.tmp`;
    import_fs2.default.writeFileSync(tmpFilePath, encryptedBuffer);
    import_fs2.default.renameSync(tmpFilePath, dbFilePath);
    createRollingBackup(encryptedBuffer);
  } catch (err) {
    console.error("[DB Security] Failed to persist encrypted SQLite database to disk:", err);
  }
}
function createRollingBackup(encryptedBuffer) {
  try {
    if (!userDataDir) return;
    const backupDir = import_path2.default.join(userDataDir, "backups");
    if (!import_fs2.default.existsSync(backupDir)) {
      import_fs2.default.mkdirSync(backupDir, { recursive: true });
    }
    const backupFile = import_path2.default.join(backupDir, "elfishawy_offline.backup.enc");
    import_fs2.default.writeFileSync(backupFile, encryptedBuffer);
  } catch (err) {
  }
}
function attemptBackupRecovery(userDataPath, key) {
  try {
    const backupFile = import_path2.default.join(userDataPath, "backups", "elfishawy_offline.backup.enc");
    if (import_fs2.default.existsSync(backupFile)) {
      const encBackup = import_fs2.default.readFileSync(backupFile);
      const recoveredBuffer = decryptBuffer(encBackup, key);
      console.log("[DB Security] Recovered database successfully from encrypted backup.");
      return recoveredBuffer;
    }
  } catch (recErr) {
    console.error("[DB Security] Backup recovery failed:", recErr.message);
  }
  return null;
}
function runMigrations(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_op_id TEXT UNIQUE NOT NULL,
      entity_type TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      sequence_id INTEGER,
      prev_hash TEXT,
      op_hash TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      _id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      _id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      image_url TEXT,
      category_id TEXT,
      in_stock INTEGER DEFAULT 1,
      stock_quantity REAL DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS recipes (
      _id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      ingredients TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
      _id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      min_limit REAL DEFAULT 5,
      cost_price REAL DEFAULT 0,
      last_restock_total_cost REAL DEFAULT 0,
      last_restocked TEXT,
      last_restocked_by TEXT,
      sync_status TEXT DEFAULT 'SYNCED',
      client_inventory_id TEXT UNIQUE,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      _id TEXT PRIMARY KEY,
      order_number TEXT,
      provisional_number TEXT,
      day_key TEXT,
      items TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'completed',
      table_number INTEGER,
      cashier_id TEXT,
      notes TEXT,
      sync_status TEXT DEFAULT 'SYNCED',
      client_order_id TEXT UNIQUE,
      created_at TEXT,
      updated_at TEXT
    );

    -- \u0639\u062F\u0627\u062F\u0627\u062A \u0645\u062D\u0644\u064A\u0629 \u0644\u0644\u062A\u0633\u0644\u0633\u0644 \u0627\u0644\u0645\u0624\u0642\u062A (\u0623\u0648\u0641\u0644\u0627\u064A\u0646) \u2014 \u0644\u0643\u0644 \u064A\u0648\u0645 \u062A\u062C\u0627\u0631\u064A \u0639\u062F\u0651\u0627\u062F \u0645\u0633\u062A\u0642\u0644 \u064A\u0628\u062F\u0623 \u0645\u0646 1.
    -- \u0644\u0627 \u0639\u0644\u0627\u0642\u0629 \u0644\u0647\u0630\u0647 \u0627\u0644\u0639\u062F\u0627\u062F\u0627\u062A \u0628\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0646\u0647\u0627\u0626\u064A\u0629 \u0627\u0644\u0635\u0627\u062F\u0631\u0629 \u0645\u0646 \u0627\u0644\u0633\u064A\u0631\u0641\u0631.
    CREATE TABLE IF NOT EXISTS local_counters (
      _id TEXT PRIMARY KEY,
      seq INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expenses (
      _id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      inventory_item_linked TEXT,
      inventory_quantity_added REAL,
      unit_cost REAL,
      date TEXT,
      added_by TEXT,
      sync_status TEXT DEFAULT 'SYNCED',
      client_expense_id TEXT UNIQUE,
      purchase_number TEXT UNIQUE,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS local_users (
      _id TEXT PRIMARY KEY,
      user_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role_type TEXT NOT NULL,
      password_hash TEXT,
      session_token TEXT,
      cached_at TEXT
    );
  `);
  try {
    db.run(`ALTER TABLE local_users ADD COLUMN session_token TEXT;`);
  } catch {
  }
  try {
    db.run(`ALTER TABLE inventory ADD COLUMN last_restock_total_cost REAL DEFAULT 0;`);
  } catch {
  }
  try {
    db.run(`ALTER TABLE inventory ADD COLUMN last_restocked TEXT;`);
  } catch {
  }
  try {
    db.run(`ALTER TABLE inventory ADD COLUMN last_restocked_by TEXT;`);
  } catch {
  }
  try {
    db.run(`ALTER TABLE sync_queue ADD COLUMN sequence_id INTEGER;`);
  } catch {
  }
  try {
    db.run(`ALTER TABLE sync_queue ADD COLUMN prev_hash TEXT;`);
  } catch {
  }
  try {
    db.run(`ALTER TABLE sync_queue ADD COLUMN op_hash TEXT;`);
  } catch {
  }
  try {
    db.run(`ALTER TABLE orders ADD COLUMN day_key TEXT;`);
  } catch {
  }
  try {
    db.run(`ALTER TABLE inventory ADD COLUMN sync_status TEXT DEFAULT 'SYNCED';`);
  } catch {
  }
  try {
    db.run(`ALTER TABLE inventory ADD COLUMN client_inventory_id TEXT;`);
  } catch {
  }
  try {
    db.run(`ALTER TABLE expenses ADD COLUMN purchase_number TEXT;`);
  } catch {
  }
  try {
    db.run(`ALTER TABLE orders ADD COLUMN provisional_number TEXT;`);
  } catch {
  }
  try {
    db.run(`CREATE TABLE IF NOT EXISTS local_counters (_id TEXT PRIMARY KEY, seq INTEGER DEFAULT 0);`);
  } catch {
  }
  try {
    db.run(`UPDATE orders SET provisional_number = order_number
            WHERE IFNULL(sync_status, 'SYNCED') = 'PENDING_SYNC'
              AND (provisional_number IS NULL OR provisional_number = '')
              AND order_number IS NOT NULL
              AND order_number GLOB '[0-9]*'
              AND order_number NOT GLOB '*[^0-9]*'`);
    db.run(`UPDATE orders SET order_number = NULL
            WHERE IFNULL(sync_status, 'SYNCED') = 'PENDING_SYNC'`);
  } catch {
  }
  try {
    db.run(`UPDATE orders SET order_number = NULL WHERE order_number GLOB '*[^0-9]*' OR LENGTH(order_number) > 6;`);
    db.run(`UPDATE orders SET provisional_number = NULL WHERE provisional_number GLOB '*[^0-9]*' OR LENGTH(provisional_number) > 6;`);
  } catch {
  }
  try {
    db.run(`
      UPDATE orders SET
        notes = CASE WHEN notes = 'PENDING_SYNC' THEN '' ELSE notes END,
        sync_status = 'PENDING_SYNC',
        client_order_id = _id,
        order_number = NULL
      WHERE _id GLOB 'off_*'
        AND IFNULL(sync_status, '') != 'SYNCED'
        AND (
          sync_status GLOB 'off_*'
          OR notes = 'PENDING_SYNC'
          OR IFNULL(sync_status, '') = ''
        )
    `);
    db.run(`
      UPDATE orders SET client_order_id = _id
      WHERE _id GLOB 'off_*'
        AND IFNULL(sync_status, '') = 'PENDING_SYNC'
        AND (client_order_id IS NULL OR client_order_id = '' OR client_order_id GLOB '20*')
    `);
  } catch {
  }
  try {
    const userCountRes = db.exec(`SELECT COUNT(*) FROM local_users`);
    const count = userCountRes.length && userCountRes[0].values.length ? Number(userCountRes[0].values[0][0]) || 0 : 0;
    if (count === 0) {
      const seedHash = "1305333a361fbaa6eecf000cbe35b2fcaf7905a82056fe98c8ce638d31c56224";
      const offlineJwt = "offline_default_cashier_token";
      const encToken = encryptSensitiveString(offlineJwt);
      db.run(`
        INSERT INTO local_users (_id, user_name, email, role_type, password_hash, session_token, cached_at)
        VALUES ('local_seed_cashier_01', '\u0643\u0627\u0634\u064A\u0631 \u0627\u0644\u0641\u064A\u0634\u0627\u0648\u064A', 'cashier@elfishawy.com', 'cashier', ?, ?, ?)
      `, [seedHash, encToken, (/* @__PURE__ */ new Date()).toISOString()]);
      console.log("\u2705 Seeded default offline cashier account (cashier@elfishawy.com)");
    }
  } catch (seedErr) {
    console.warn("Failed to seed default offline user:", seedErr.message);
  }
}
function getDb() {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call initDatabase first.");
  }
  return dbInstance;
}
function getMasterKey() {
  return masterKey;
}

// desktop/main/ipc.js
var import_electron3 = require("electron");

// desktop/main/httpClient.js
var import_http = __toESM(require("http"), 1);
var import_https = __toESM(require("https"), 1);
function httpFetch(input, options = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(String(input));
    } catch (error) {
      reject(error);
      return;
    }
    const transport = url.protocol === "https:" ? import_https.default : url.protocol === "http:" ? import_http.default : null;
    if (!transport) {
      reject(new Error(`Unsupported protocol: ${url.protocol}`));
      return;
    }
    if (options.signal?.aborted) {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      reject(error);
      return;
    }
    const request = transport.request(url, {
      method: options.method || "GET",
      headers: options.headers || {}
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("error", reject);
      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve({
          ok: (response.statusCode || 0) >= 200 && (response.statusCode || 0) < 300,
          status: response.statusCode || 0,
          text: async () => body,
          json: async () => JSON.parse(body)
        });
      });
    });
    const abortRequest = () => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      request.destroy(error);
    };
    options.signal?.addEventListener("abort", abortRequest, { once: true });
    request.on("error", reject);
    request.on("close", () => options.signal?.removeEventListener("abort", abortRequest));
    if (options.body !== void 0 && options.body !== null) request.write(options.body);
    request.end();
  });
}

// desktop/main/sync.js
var isSyncing = false;
var isRunningSyncCycle = false;
var syncIntervalTimer = null;
var lastServerPullAt = 0;
var SERVER_PULL_INTERVAL_MS = 15e3;
var testMode = process.env.ELECTRON_TEST_MODE === "true";
var testApiUrl = process.env.ELECTRON_TEST_API_URL || "";
if (testMode && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(testApiUrl)) {
  throw new Error("Electron test mode requires a localhost ELECTRON_TEST_API_URL");
}
var apiBaseUrl = testMode ? testApiUrl : "https://elfishawy-cafe-server.vercel.app";
var authToken = "";
function configureSync({ serverUrl, token }) {
  if (serverUrl) apiBaseUrl = serverUrl.replace(/\/$/, "");
  if (token) authToken = token;
}
function getAuthToken() {
  if (authToken && authToken !== "offline_default_cashier_token" && authToken.split(".").length === 3) {
    return authToken;
  }
  try {
    const db = getDb();
    const res = db.exec(`SELECT session_token FROM local_users WHERE session_token IS NOT NULL AND session_token != '' ORDER BY cached_at DESC`);
    if (res.length && res[0].values.length) {
      for (const row of res[0].values) {
        const stored = row[0];
        const decrypted = decryptSensitiveString(stored);
        if (decrypted && decrypted !== "offline_default_cashier_token" && decrypted.split(".").length === 3) {
          authToken = decrypted;
          return authToken;
        }
      }
    }
  } catch {
  }
  return "";
}
var isMongoObjectId = (value) => typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value);
function resolveServerInventoryId(db, localId) {
  if (!localId) return "";
  if (isMongoObjectId(localId)) return localId;
  try {
    const res = db.exec(
      `SELECT _id FROM inventory WHERE _id = ? OR client_inventory_id = ? LIMIT 1`,
      [String(localId), String(localId)]
    );
    const resolved = res.length && res[0].values.length ? String(res[0].values[0][0] || "") : "";
    return isMongoObjectId(resolved) ? resolved : "";
  } catch {
    return "";
  }
}
function reconcileInventoryWithServer(db, localId, serverItem) {
  const serverId = String(serverItem?._id || "");
  const clientId = String(localId || serverItem?.clientInventoryId || "");
  if (!clientId || !isMongoObjectId(serverId)) return false;
  const serverRow = db.exec(`SELECT 1 FROM inventory WHERE _id = ? LIMIT 1`, [serverId]);
  if (serverRow.length && serverRow[0].values.length) {
    db.run(
      `DELETE FROM inventory WHERE (_id = ? OR client_inventory_id = ?) AND _id != ?`,
      [clientId, clientId, serverId]
    );
    db.run(
      `UPDATE inventory SET client_inventory_id = ?, sync_status = 'SYNCED', updated_at = ? WHERE _id = ?`,
      [clientId, (/* @__PURE__ */ new Date()).toISOString(), serverId]
    );
  } else {
    db.run(
      `UPDATE inventory SET _id = ?, sync_status = 'SYNCED', client_inventory_id = ?, updated_at = ? WHERE _id = ? OR client_inventory_id = ?`,
      [serverId, clientId, (/* @__PURE__ */ new Date()).toISOString(), clientId, clientId]
    );
  }
  return true;
}
function reconcileRestockExpenseWithServer(db, clientRestockId, serverExpenseId) {
  return reconcileExpenseWithServer(db, clientRestockId, serverExpenseId);
}
function reconcileExpenseWithServer(db, clientExpenseId, serverExpense) {
  const clientId = String(clientExpenseId || "");
  const result = serverExpense && typeof serverExpense === "object" ? serverExpense : { _id: serverExpense };
  const serverId = String(result._id || "");
  const purchaseNumber = result.purchaseNumber || null;
  if (!clientId || !isMongoObjectId(serverId)) return false;
  const serverRow = db.exec(`SELECT 1 FROM expenses WHERE _id = ? LIMIT 1`, [serverId]);
  if (serverRow.length && serverRow[0].values.length) {
    db.run(`DELETE FROM expenses WHERE client_expense_id = ? AND _id != ?`, [clientId, serverId]);
  }
  db.run(
    `UPDATE expenses SET _id = ?, sync_status = "SYNCED", client_expense_id = ?, purchase_number = COALESCE(?, purchase_number) WHERE client_expense_id = ? OR _id = ? OR _id = ?`,
    [serverId, clientId, purchaseNumber, clientId, clientId, serverId]
  );
  db.run(
    `UPDATE sync_queue SET status = "COMPLETED", synced_at = ? WHERE client_op_id = ? AND status IN ("PENDING", "FAILED")`,
    [(/* @__PURE__ */ new Date()).toISOString(), clientId]
  );
  try {
    const expRow = db.exec(`SELECT inventory_item_linked FROM expenses WHERE _id = ? LIMIT 1`, [serverId]);
    if (expRow.length && expRow[0].values.length) {
      const linkedInvId = expRow[0].values[0][0];
      if (linkedInvId) {
        db.run(`UPDATE inventory SET sync_status = "SYNCED" WHERE _id = ? OR client_inventory_id = ?`, [linkedInvId, linkedInvId]);
      }
    }
  } catch {
  }
  return true;
}
function cacheServerExpense(db, exp) {
  if (!exp?._id) return false;
  const clientExpenseId = exp.clientExpenseId || exp.client_expense_id || "";
  const purchaseNumber = exp.purchaseNumber || exp.purchase_number || "";
  const pendingCheck = db.exec(
    `SELECT 1 FROM expenses
     WHERE IFNULL(sync_status, 'SYNCED') = 'PENDING_SYNC'
       AND (client_expense_id = ? OR client_expense_id = ? OR (? != '' AND purchase_number = ?))
     LIMIT 1`,
    [exp._id, clientExpenseId, purchaseNumber, purchaseNumber]
  );
  if (pendingCheck.length && pendingCheck[0].values.length) return false;
  const collisions = db.exec(
    `SELECT _id FROM expenses
     WHERE _id != ? AND (
       (? != '' AND client_expense_id = ?) OR
       (? != '' AND purchase_number = ?)
     ) AND IFNULL(sync_status, 'SYNCED') != 'PENDING_SYNC'`,
    [String(exp._id), String(clientExpenseId), String(clientExpenseId), String(purchaseNumber), String(purchaseNumber)]
  );
  if (collisions.length && collisions[0].values.length) {
    for (const [collisionId] of collisions[0].values) {
      db.run(`DELETE FROM expenses WHERE _id = ?`, [collisionId]);
    }
  }
  const linked = typeof exp.inventoryItemLinked === "object" ? exp.inventoryItemLinked?._id || exp.inventoryItemLinked?.id || null : exp.inventoryItemLinked || null;
  const addedBy = typeof exp.addedBy === "object" ? exp.addedBy?._id || "" : exp.addedBy || "";
  const createdAt = exp.createdAt || exp.date || (/* @__PURE__ */ new Date()).toISOString();
  db.run(`
    INSERT INTO expenses (_id, description, amount, category, inventory_item_linked, inventory_quantity_added, unit_cost, date, added_by, sync_status, client_expense_id, purchase_number, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?, ?)
    ON CONFLICT(_id) DO UPDATE SET
      description = excluded.description,
      amount = excluded.amount,
      category = excluded.category,
      inventory_item_linked = excluded.inventory_item_linked,
      inventory_quantity_added = excluded.inventory_quantity_added,
      unit_cost = excluded.unit_cost,
      date = excluded.date,
      added_by = excluded.added_by,
      purchase_number = COALESCE(excluded.purchase_number, expenses.purchase_number),
      client_expense_id = excluded.client_expense_id,
      sync_status = 'SYNCED'
    WHERE IFNULL(expenses.sync_status, 'SYNCED') != 'PENDING_SYNC'
  `, [
    exp._id,
    exp.description || "",
    Number(exp.amount) || 0,
    exp.category || "other",
    linked,
    Number(exp.inventoryQuantityAdded) || null,
    Number(exp.unitCost) || null,
    exp.date || createdAt,
    addedBy,
    clientExpenseId || null,
    purchaseNumber || null,
    createdAt
  ]);
  return true;
}
function cacheServerProduct(db, product) {
  if (!product?._id) return false;
  const categoryId = typeof product.category === "object" ? product.category?._id || "" : product.category || "";
  const imageUrl = product.image?.secure_url || product.image?.url || "";
  db.run(`
    INSERT INTO products (_id, name, price, description, image_url, category_id, in_stock, stock_quantity, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(_id) DO UPDATE SET
      name = excluded.name,
      price = excluded.price,
      description = excluded.description,
      image_url = excluded.image_url,
      category_id = excluded.category_id,
      in_stock = CASE WHEN EXISTS (
        SELECT 1 FROM sync_queue WHERE status IN ('PENDING', 'FAILED')
          AND entity_type IN ('order', 'expense', 'inventory_restock', 'inventory_create')
      ) THEN products.in_stock ELSE excluded.in_stock END,
      stock_quantity = CASE WHEN EXISTS (
        SELECT 1 FROM sync_queue WHERE status IN ('PENDING', 'FAILED')
          AND entity_type IN ('order', 'expense', 'inventory_restock', 'inventory_create')
      ) THEN products.stock_quantity ELSE excluded.stock_quantity END,
      updated_at = excluded.updated_at
  `, [
    String(product._id),
    String(product.name || ""),
    Number(product.price) || 0,
    product.description || "",
    imageUrl,
    categoryId,
    product.inStock ? 1 : 0,
    Number(product.stockQuantity) || 0,
    product.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
  ]);
  return true;
}
function deferSyncQueueItem(db, queueId, attempts, message) {
  db.run(
    `UPDATE sync_queue SET status = 'PENDING', attempts = ?, last_error = ? WHERE id = ?`,
    [Number(attempts) + 1, message, queueId]
  );
}
function reconcileOrderWithServer(db, clientOrderId, serverResult) {
  if (!clientOrderId || !serverResult?.orderNumber) return false;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const orderNumber = String(serverResult.orderNumber);
  const serverId = serverResult._id;
  try {
    const existingCheck = db.exec(`SELECT _id FROM orders WHERE _id = ?`, [serverId]);
    if (existingCheck.length && existingCheck[0].values.length) {
      db.run(`DELETE FROM orders WHERE client_order_id = ? AND _id != ?`, [clientOrderId, serverId]);
      db.run(
        `UPDATE orders SET order_number = ?, sync_status = 'SYNCED', client_order_id = ?, updated_at = ? WHERE _id = ?`,
        [orderNumber, clientOrderId, nowIso, serverId]
      );
    } else {
      db.run(
        `UPDATE orders SET _id = ?, order_number = ?, sync_status = 'SYNCED', updated_at = ? WHERE client_order_id = ?`,
        [serverId, orderNumber, nowIso, clientOrderId]
      );
    }
    db.run(
      `UPDATE sync_queue SET status = 'COMPLETED', synced_at = ? WHERE client_op_id = ? AND entity_type = 'order' AND status IN ('PENDING', 'FAILED')`,
      [nowIso, clientOrderId]
    );
    return true;
  } catch (err) {
    console.error("reconcileOrderWithServer error:", err.message);
    return false;
  }
}
async function processSyncQueue(mainWindow2) {
  if (isSyncing) return { success: false, busy: true, message: "\u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u062C\u0627\u0631\u064A\u0629 \u0628\u0627\u0644\u0641\u0639\u0644" };
  isSyncing = true;
  try {
    const token = getAuthToken();
    if (!token) return { success: false, message: "No authenticated session" };
    const db = getDb();
    const res = db.exec(`
      SELECT id, client_op_id, entity_type, action, payload, attempts, sequence_id, prev_hash, op_hash
      FROM sync_queue
      WHERE status IN ('PENDING', 'FAILED')
        AND (entity_type != 'order' OR EXISTS (
          SELECT 1 FROM orders WHERE orders.client_order_id = sync_queue.client_op_id
        ))
      ORDER BY id ASC
    `);
    if (!res.length || !res[0].values.length) {
      isSyncing = false;
      return { success: true, count: 0 };
    }
    const rows2 = res[0].values;
    let syncedCount = 0;
    const syncedEntities = /* @__PURE__ */ new Set();
    for (const row of rows2) {
      const [id, clientOpId, entityType, action, payloadStr, attempts, sequenceId, prevHash, opHash] = row;
      let payload;
      try {
        payload = JSON.parse(payloadStr);
      } catch (err) {
        db.run(`UPDATE sync_queue SET status = 'FAILED', last_error = 'Invalid JSON payload' WHERE id = ?`, [id]);
        continue;
      }
      const masterKey2 = getMasterKey();
      if (masterKey2 && opHash) {
        const expectedHash = computeOpHash(masterKey2, {
          sequenceId: Number(sequenceId) || 0,
          clientOpId,
          entityType,
          action,
          payload: payloadStr,
          prevHash: prevHash || "ROOT_GENESIS"
        });
        if (expectedHash !== opHash) {
          console.error(`[Security Alert] Tamper detected on queue item #${id} (${clientOpId})! Hash mismatch.`);
          db.run(`UPDATE sync_queue SET status = 'BLOCKED_TAMPERED', last_error = 'Security Alert: Operation integrity hash mismatch' WHERE id = ?`, [id]);
          continue;
        }
        const prevRowRes = db.exec(`SELECT op_hash, sequence_id FROM sync_queue WHERE id < ? ORDER BY id DESC LIMIT 1`, [id]);
        if (prevRowRes.length && prevRowRes[0].values.length) {
          const [actualPrevHash, actualPrevSeq] = prevRowRes[0].values[0];
          const expectedPrevSeq = (Number(sequenceId) || 0) - 1;
          if (actualPrevHash && prevHash && actualPrevHash !== prevHash) {
            console.error(`[Security Alert] Chain break detected on queue item #${id}! Preceding hash mismatch (possible deletion).`);
            db.run(`UPDATE sync_queue SET status = 'BLOCKED_TAMPERED', last_error = 'Security Alert: Preceding chain hash mismatch (deleted item detected)' WHERE id = ?`, [id]);
            continue;
          }
          if (actualPrevSeq !== void 0 && Number(sequenceId) > 1 && actualPrevSeq !== expectedPrevSeq) {
            console.error(`[Security Alert] Sequence gap detected! Expected #${expectedPrevSeq}, got #${actualPrevSeq}.`);
            db.run(`UPDATE sync_queue SET status = 'BLOCKED_TAMPERED', last_error = 'Security Alert: Sequence gap detected (missing item)' WHERE id = ?`, [id]);
            continue;
          }
        }
      }
      try {
        if (mainWindow2) {
          mainWindow2.webContents.send("sync:progress", {
            clientOpId,
            entityType,
            status: "SYNCING"
          });
        }
        let success = false;
        let serverResult = null;
        if (entityType === "order") {
          const rawItems = Array.isArray(payload.items) ? payload.items : [];
          const orderResponse = await httpFetch(`${apiBaseUrl}/orders`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "authorization": token || ""
            },
            body: JSON.stringify({
              items: rawItems.map((it) => ({
                product: typeof it.product === "object" ? it.product?._id || it.product?.id || "" : String(it.product || ""),
                quantity: Number(it.quantity) || 1,
                price: Number(it.price) || 0
              })),
              tableNumber: payload.tableNumber,
              notes: payload.notes || "",
              clientOrderId: clientOpId,
              // لا نرسل أي رقم للسيرفر: الرقم النهائي يُصدره السيرفر فقط من العداد اليومي الذري
              // (الرقم المؤقت المحلي للعرض/الطباعة فقط ولا يصلح رقماً نهائياً).
              clientCreatedAt: payload.createdAt
            }),
            signal: AbortSignal.timeout(1e4)
          });
          const data = await orderResponse.json().catch(() => ({}));
          if (orderResponse.ok && data.success) {
            serverResult = data.data;
            const finalOrderNumber = String(serverResult?.orderNumber ?? serverResult?.order_number ?? "").trim();
            if (!/^\d+$/.test(finalOrderNumber)) {
              throw new Error("Server accepted order without returning its final invoice number; retrying reconciliation");
            }
            if (!reconcileOrderWithServer(db, clientOpId, serverResult)) {
              throw new Error("Server accepted order, but its final invoice number could not be saved locally; retrying reconciliation");
            }
            success = true;
          } else {
            const err = new Error(data.message || `Server returned ${orderResponse.status} for order`);
            err.statusCode = orderResponse.status;
            throw err;
          }
        } else if (entityType === "expense") {
          let linkedId = typeof payload.inventoryItemLinked === "object" ? payload.inventoryItemLinked?._id || payload.inventoryItemLinked?.id : payload.inventoryItemLinked;
          if (linkedId && !isMongoObjectId(linkedId)) {
            const serverItemId = resolveServerInventoryId(db, linkedId);
            if (serverItemId) {
              linkedId = serverItemId;
            } else {
              deferSyncQueueItem(db, id, attempts, "Waiting for linked inventory item to sync");
              continue;
            }
          }
          const expenseResponse = await httpFetch(`${apiBaseUrl}/expenses`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "authorization": token || ""
            },
            body: JSON.stringify({
              description: payload.description,
              amount: Number(payload.amount) || 0,
              category: payload.category || "inventory",
              inventoryItemLinked: linkedId || void 0,
              inventoryQuantityAdded: payload.inventoryQuantityAdded ? Number(payload.inventoryQuantityAdded) : void 0,
              totalCost: payload.totalCost !== void 0 ? Number(payload.totalCost) : Number(payload.amount),
              unitCost: payload.unitCost !== void 0 ? Number(payload.unitCost) : void 0,
              date: payload.date || (/* @__PURE__ */ new Date()).toISOString(),
              clientExpenseId: clientOpId
            }),
            signal: AbortSignal.timeout(1e4)
          });
          const data = await expenseResponse.json().catch(() => ({}));
          if (expenseResponse.ok && data.success) {
            success = true;
            serverResult = data.data;
            if (!reconcileExpenseWithServer(db, clientOpId, serverResult)) {
              throw new Error("Server returned an invalid expense ID for reconciliation");
            }
          } else {
            const err = new Error(data.message || `Server returned ${expenseResponse.status} for expense`);
            err.statusCode = expenseResponse.status;
            throw err;
          }
        } else if (entityType === "inventory_restock") {
          const rawRestockItemId = payload.id || payload._id || payload.inventoryId;
          const restockItemId = resolveServerInventoryId(db, rawRestockItemId);
          if (!restockItemId) {
            deferSyncQueueItem(db, id, attempts, "Waiting for inventory item to sync");
            continue;
          }
          const restockResponse = await httpFetch(`${apiBaseUrl}/inventory/${restockItemId}/restock`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "authorization": token || ""
            },
            body: JSON.stringify({
              quantity: Number(payload.quantity) || 0,
              totalCost: payload.totalCost !== void 0 ? Number(payload.totalCost) : void 0,
              costPrice: payload.costPrice !== void 0 ? Number(payload.costPrice) : void 0,
              // ⏱️ وقت التوريد الأصلي (يوم العملية) مش وقت وصول المزامنة — عشان قيد
              // الشراء يتحسب في نفس اليوم التجاري على المنصة زي الديسكتوب.
              date: payload.date || void 0,
              // معرّف العملية الأوفلاين — يمنع رفع الرصيد مرتين عند إعادة الإرسال
              clientRestockId: payload.clientRestockId || clientOpId
            }),
            signal: AbortSignal.timeout(1e4)
          });
          const data = await restockResponse.json().catch(() => ({}));
          if (restockResponse.ok && data.success) {
            if (!reconcileRestockExpenseWithServer(db, clientOpId, {
              _id: data.expenseId,
              purchaseNumber: data.purchaseNumber
            })) {
              throw new Error("Server did not return the restock purchase ID for reconciliation");
            }
            db.run(
              `UPDATE inventory SET sync_status = 'SYNCED' WHERE _id = ? OR client_inventory_id = ?`,
              [restockItemId, rawRestockItemId]
            );
            success = true;
          } else {
            const err = new Error(data.message || `Server returned ${restockResponse.status} for restock`);
            err.statusCode = restockResponse.status;
            throw err;
          }
        } else if (entityType === "inventory_create") {
          const createResponse = await httpFetch(`${apiBaseUrl}/inventory`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "authorization": token || ""
            },
            body: JSON.stringify({
              name: payload.name,
              quantity: Number(payload.quantity) || 0,
              unit: payload.unit || "KG",
              minLimit: payload.minLimit !== void 0 ? Number(payload.minLimit) : 5,
              costPrice: payload.costPrice !== void 0 ? Number(payload.costPrice) : void 0,
              totalCost: payload.totalCost !== void 0 ? Number(payload.totalCost) : void 0,
              clientInventoryId: payload.clientInventoryId || clientOpId
            }),
            signal: AbortSignal.timeout(1e4)
          });
          const data = await createResponse.json().catch(() => ({}));
          if (createResponse.ok && data.success && data.data) {
            success = true;
            serverResult = data.data;
            const localId = payload.clientInventoryId || clientOpId;
            if (!reconcileInventoryWithServer(db, localId, serverResult)) {
              throw new Error("Server returned an invalid inventory ID for reconciliation");
            }
            if (data.openingExpense) {
              const openingExpenseId = data.openingExpense.clientExpenseId || `${localId}:opening`;
              if (!reconcileExpenseWithServer(db, openingExpenseId, data.openingExpense)) {
                throw new Error("Server returned an invalid opening purchase ID for reconciliation");
              }
            }
          } else {
            const err = new Error(data.message || `Server returned ${createResponse.status} for inventory create`);
            err.statusCode = createResponse.status;
            throw err;
          }
        }
        if (success) {
          db.run(
            `UPDATE sync_queue SET status = 'COMPLETED', synced_at = ? WHERE id = ?`,
            [(/* @__PURE__ */ new Date()).toISOString(), id]
          );
          syncedCount++;
          syncedEntities.add(entityType);
        }
      } catch (err) {
        console.error(`Error syncing operation ${clientOpId}:`, err.message);
        const isAuthError = err.statusCode === 401 || err.message?.includes("401") || err.message?.includes("Unauthorized");
        const isNetworkError = err.name === "TypeError" || err.name === "AbortError" || err.name === "TimeoutError" || err.message?.includes("fetch failed") || err.message?.includes("NetworkError") || err.message?.includes("ENOTFOUND") || err.message?.includes("ECONNREFUSED");
        const newStatus = isAuthError || isNetworkError ? "PENDING" : "FAILED";
        db.run(
          `UPDATE sync_queue SET status = ?, attempts = ?, last_error = ? WHERE id = ?`,
          [newStatus, isAuthError ? attempts : attempts + 1, err.message, id]
        );
        if (isAuthError) {
          if (mainWindow2 && !mainWindow2.isDestroyed()) {
            mainWindow2.webContents.send("sync:auth-required");
          }
          break;
        }
      }
    }
    saveDatabase();
    if (mainWindow2 && !mainWindow2.isDestroyed()) {
      mainWindow2.webContents.send("sync:progress", { status: "DONE", count: syncedCount });
      if (syncedCount > 0) {
        const changed = {
          orders: syncedEntities.has("order"),
          inventory: syncedEntities.has("inventory_create") || syncedEntities.has("inventory_restock"),
          expenses: syncedEntities.has("expense") || syncedEntities.has("inventory_create") || syncedEntities.has("inventory_restock"),
          products: syncedEntities.has("order") || syncedEntities.has("inventory_create") || syncedEntities.has("inventory_restock") || syncedEntities.has("expense")
        };
        mainWindow2.webContents.send("sync:data-updated", changed);
      }
    }
    const pendingRes = db.exec(`
      SELECT COUNT(*) FROM sync_queue WHERE status IN ('PENDING', 'FAILED')
    `);
    const pendingCount = Number(pendingRes?.[0]?.values?.[0]?.[0]) || 0;
    const failedRes = db.exec(`
      SELECT entity_type, last_error FROM sync_queue
      WHERE status = 'FAILED' ORDER BY id ASC LIMIT 1
    `);
    const failedRow = failedRes?.[0]?.values?.[0];
    return {
      success: pendingCount === 0,
      count: syncedCount,
      pendingCount,
      message: pendingCount === 0 ? syncedCount > 0 ? `\u062A\u0645 \u0631\u0641\u0639 ${syncedCount} \u0639\u0645\u0644\u064A\u0629 \u0628\u0646\u062C\u0627\u062D` : "\u0644\u0627 \u062A\u0648\u062C\u062F \u0639\u0645\u0644\u064A\u0627\u062A \u0645\u0639\u0644\u0642\u0629 \u0644\u0644\u0645\u0632\u0627\u0645\u0646\u0629" : failedRow?.[1] || `\u062A\u0639\u0630\u0631 \u0631\u0641\u0639 ${pendingCount} \u0639\u0645\u0644\u064A\u0629 \u2014 \u0631\u0627\u062C\u0639 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0623\u0648 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062D\u0633\u0627\u0628`
    };
  } catch (error) {
    console.error("Sync queue execution error:", error);
    return { success: false, error: error.message };
  } finally {
    isSyncing = false;
  }
}
var isPulling = false;
async function pullServerUpdates(mainWindow2) {
  if (isPulling) return { success: false, message: "\u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u062C\u0627\u0631\u064A\u0629 \u0628\u0627\u0644\u0641\u0639\u0644" };
  isPulling = true;
  lastServerPullAt = Date.now();
  try {
    const token = getAuthToken();
    if (!token) return { success: false, message: "\u0644\u0627 \u062A\u0648\u062C\u062F \u062C\u0644\u0633\u0629 \u062F\u062E\u0648\u0644 \u0635\u0627\u0644\u062D\u0629 \u0644\u0644\u0645\u0632\u0627\u0645\u0646\u0629" };
    const db = getDb();
    const authHeaders = { authorization: token };
    const [ordersRes, invRes, expRes, productsRes, categoriesRes, recipesRes] = await Promise.all(
      [
        ["/orders", 1e4],
        ["/inventory", 8e3],
        ["/expenses", 8e3],
        ["/products", 8e3],
        ["/categories", 8e3],
        ["/recipes", 8e3]
      ].map(([route, timeoutMs]) => httpFetch(`${apiBaseUrl}${route}`, {
        method: "GET",
        headers: authHeaders,
        signal: AbortSignal.timeout(timeoutMs)
      }).catch(() => null))
    );
    if (!invRes) {
      throw new Error("\u062A\u0639\u0630\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u062E\u062F\u0645\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u2014 \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A \u0648\u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649");
    }
    if (invRes.status === 401 || invRes.status === 403) {
      throw new Error("\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062C\u0644\u0633\u0629 \u0623\u0648 \u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u2014 \u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0646 \u062C\u062F\u064A\u062F");
    }
    if (!invRes.ok) {
      throw new Error(`\u0641\u0634\u0644 \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0645\u0646 \u0627\u0644\u0633\u064A\u0631\u0641\u0631 (HTTP ${invRes.status})`);
    }
    let hasNewOrders = false;
    if (ordersRes && ordersRes.ok) {
      const ordersData = await ordersRes.json();
      if (ordersData.success && Array.isArray(ordersData.data)) {
        for (const ord of ordersData.data) {
          if (!ord || !ord._id) continue;
          try {
            const existing = db.exec(`SELECT sync_status FROM orders WHERE _id = ?`, [ord._id]);
            if (existing.length && existing[0].values.length && existing[0].values[0][0] === "PENDING_SYNC") {
              continue;
            }
            const clientOrderId = ord.clientOrderId || ord.client_order_id || null;
            if (clientOrderId) {
              db.run(`DELETE FROM orders WHERE client_order_id = ? AND _id != ?`, [clientOrderId, ord._id]);
            }
            const itemsJson = JSON.stringify(ord.items || []);
            const createdAt = ord.createdAt || ord.created_at || (/* @__PURE__ */ new Date()).toISOString();
            const updatedAt = ord.updatedAt || ord.updated_at || createdAt;
            const rawNum = String(ord.orderNumber || ord.order_number || "").trim();
            const orderNumber = /^\d{1,6}$/.test(rawNum) ? rawNum : null;
            const tableNumber = ord.tableNumber ?? ord.table_number ?? null;
            const cashierId = typeof ord.cashierId === "object" ? ord.cashierId?._id || "" : ord.cashierId || "";
            const dayKey = ord.dayKey || null;
            db.run(`
              INSERT INTO orders (_id, order_number, day_key, items, total_amount, status, table_number, cashier_id, notes, sync_status, client_order_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?, ?)
              ON CONFLICT(_id) DO UPDATE SET
                order_number = excluded.order_number,
                day_key = COALESCE(excluded.day_key, orders.day_key),
                items = excluded.items,
                total_amount = excluded.total_amount,
                status = excluded.status,
                table_number = excluded.table_number,
                cashier_id = excluded.cashier_id,
                notes = excluded.notes,
                client_order_id = COALESCE(excluded.client_order_id, orders.client_order_id),
                created_at = COALESCE(orders.created_at, excluded.created_at),
                updated_at = excluded.updated_at
              WHERE IFNULL(orders.sync_status, 'SYNCED') != 'PENDING_SYNC'
            `, [
              ord._id,
              orderNumber,
              dayKey,
              itemsJson,
              Number(ord.totalAmount ?? ord.total_amount) || 0,
              ord.status || "completed",
              tableNumber,
              cashierId,
              ord.notes || "",
              clientOrderId,
              createdAt,
              updatedAt
            ]);
            hasNewOrders = true;
          } catch (ordErr) {
          }
        }
      }
    }
    let hasNewInventory = false;
    if (invRes && invRes.ok) {
      const invData = await invRes.json();
      if (invData.success && Array.isArray(invData.data)) {
        for (const item of invData.data) {
          if (!item || !item._id) continue;
          const localClientId = item.clientInventoryId || item.client_inventory_id || "";
          const pendingItem = db.exec(
            `SELECT 1 FROM inventory
             WHERE IFNULL(sync_status, 'SYNCED') = 'PENDING_SYNC'
               AND (_id = ?
                    OR (client_inventory_id IS NOT NULL AND client_inventory_id != '' AND client_inventory_id = ?))
             LIMIT 1`,
            [item._id, localClientId]
          );
          if (pendingItem.length && pendingItem[0].values.length) continue;
          db.run(`
            INSERT INTO inventory (_id, name, quantity, unit, min_limit, cost_price, last_restock_total_cost, last_restocked, updated_at, sync_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')
            ON CONFLICT(_id) DO UPDATE SET
              name = excluded.name,
              quantity = excluded.quantity,
              unit = excluded.unit,
              min_limit = excluded.min_limit,
              cost_price = excluded.cost_price,
              last_restock_total_cost = excluded.last_restock_total_cost,
              last_restocked = excluded.last_restocked,
              updated_at = excluded.updated_at
            WHERE IFNULL(inventory.sync_status, 'SYNCED') != 'PENDING_SYNC'
          `, [
            item._id,
            item.name,
            Number(item.quantity) || 0,
            item.unit || "KG",
            Number(item.minLimit) || 5,
            Number(item.costPrice) || 0,
            Number(item.lastRestockTotalCost) || 0,
            item.lastRestocked || "",
            item.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
          ]);
          hasNewInventory = true;
        }
      }
    }
    let hasNewExpenses = false;
    if (expRes && expRes.ok) {
      const expData = await expRes.json();
      if (expData.success && Array.isArray(expData.data)) {
        for (const exp of expData.data) {
          if (!exp || !exp._id) continue;
          try {
            if (cacheServerExpense(db, exp)) hasNewExpenses = true;
          } catch (expErr) {
          }
        }
      }
    }
    let hasNewProducts = false;
    if (productsRes?.ok) {
      const productsData = await productsRes.json().catch(() => null);
      if (productsData?.success && Array.isArray(productsData.data)) {
        for (const product of productsData.data) {
          try {
            if (cacheServerProduct(db, product)) hasNewProducts = true;
          } catch (productErr) {
            console.warn("[Sync] Failed to cache product:", product?._id, productErr?.message);
          }
        }
      }
    }
    let hasNewCategories = false;
    if (categoriesRes?.ok) {
      const categoriesData = await categoriesRes.json().catch(() => null);
      if (categoriesData?.success && Array.isArray(categoriesData.data)) {
        for (const category of categoriesData.data) {
          if (!category?._id) continue;
          db.run(`
            INSERT INTO categories (_id, name, description, updated_at) VALUES (?, ?, ?, ?)
            ON CONFLICT(_id) DO UPDATE SET
              name = excluded.name, description = excluded.description, updated_at = excluded.updated_at
          `, [category._id, category.name || "", category.description || "", category.updatedAt || (/* @__PURE__ */ new Date()).toISOString()]);
          hasNewCategories = true;
        }
      }
    }
    let hasNewRecipes = false;
    if (recipesRes?.ok) {
      const recipesData = await recipesRes.json().catch(() => null);
      if (recipesData?.success && Array.isArray(recipesData.data)) {
        for (const recipe of recipesData.data) {
          if (!recipe?._id) continue;
          const productId = typeof recipe.product === "object" ? recipe.product?._id : recipe.product;
          if (!productId) continue;
          db.run(`
            INSERT INTO recipes (_id, product_id, ingredients, is_active, updated_at) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(_id) DO UPDATE SET
              product_id = excluded.product_id, ingredients = excluded.ingredients,
              is_active = excluded.is_active, updated_at = excluded.updated_at
          `, [recipe._id, productId, JSON.stringify(recipe.ingredients || []), recipe.isActive ? 1 : 0, recipe.updatedAt || (/* @__PURE__ */ new Date()).toISOString()]);
          hasNewRecipes = true;
        }
      }
    }
    if (hasNewOrders || hasNewInventory || hasNewExpenses || hasNewProducts || hasNewCategories || hasNewRecipes) {
      saveDatabase();
      if (mainWindow2 && !mainWindow2.isDestroyed()) {
        mainWindow2.webContents.send("sync:data-updated", {
          orders: hasNewOrders,
          inventory: hasNewInventory,
          expenses: hasNewExpenses,
          products: hasNewProducts,
          categories: hasNewCategories,
          recipes: hasNewRecipes
        });
      }
    }
    lastServerPullAt = Date.now();
    return { success: true, inventoryUpdated: hasNewInventory };
  } catch (pullErr) {
    console.warn("[Sync] Pull updates warning:", pullErr.message);
    return { success: false, message: pullErr.message || "\u062A\u0639\u0630\u0631 \u0645\u0632\u0627\u0645\u0646\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062E\u0632\u0648\u0646" };
  } finally {
    isPulling = false;
  }
}
async function runSyncCycle(mainWindow2, { forcePull = false } = {}) {
  if (isRunningSyncCycle) {
    if (forcePull) return processSyncQueue(mainWindow2);
    return { success: false, busy: true, message: "\u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u062C\u0627\u0631\u064A\u0629 \u0628\u0627\u0644\u0641\u0639\u0644" };
  }
  isRunningSyncCycle = true;
  try {
    if (!getAuthToken()) return { success: false, message: "No authenticated session" };
    const upload = await processSyncQueue(mainWindow2);
    const pullIsDue = forcePull || Date.now() - lastServerPullAt >= SERVER_PULL_INTERVAL_MS;
    if (forcePull) {
      if (isPulling) return upload;
      void pullServerUpdates(mainWindow2).catch((err) => {
        console.warn("[Sync] Background pull failed:", err?.message || err);
      });
      return upload;
    } else if (pullIsDue && !isPulling) {
      void pullServerUpdates(mainWindow2).catch((err) => {
        console.warn("[Sync] Background pull failed:", err?.message || err);
      });
    }
    return upload;
  } finally {
    isRunningSyncCycle = false;
  }
}
function startBackgroundSync(mainWindow2, intervalMs = 1e3) {
  if (syncIntervalTimer) clearInterval(syncIntervalTimer);
  syncIntervalTimer = setInterval(() => {
    void runSyncCycle(mainWindow2).catch((err) => {
      console.warn("[Sync] Background cycle failed:", err?.message || err);
    });
  }, intervalMs);
}

// desktop/main/inventoryCache.js
function cacheServerInventoryItem(db, inv) {
  if (!db || !inv || !inv._id) return false;
  const clientInventoryId = inv.clientInventoryId || inv.client_inventory_id || "";
  const linkedPendingOrder = db.exec(
    `SELECT 1 FROM orders o
     JOIN sync_queue q ON q.client_op_id = o.client_order_id
     WHERE o.sync_status = 'PENDING_SYNC'
       AND q.entity_type = 'order'
       AND q.status IN ('PENDING', 'FAILED')
       AND (o.items LIKE '%' || ? || '%' OR o.items LIKE '%' || ? || '%')
     LIMIT 1`,
    [String(inv._id), String(clientInventoryId)]
  );
  if (linkedPendingOrder.length && linkedPendingOrder[0].values.length) return false;
  const pendingItem = db.exec(
    `SELECT 1 FROM inventory
     WHERE IFNULL(sync_status, 'SYNCED') = 'PENDING_SYNC'
       AND (_id = ? OR (client_inventory_id IS NOT NULL AND client_inventory_id != '' AND client_inventory_id = ?))
     LIMIT 1`,
    [inv._id, clientInventoryId]
  );
  if (pendingItem.length && pendingItem[0].values.length) return false;
  if (clientInventoryId) {
    try {
      db.run(
        `DELETE FROM inventory
         WHERE _id != ? AND client_inventory_id = ?
           AND EXISTS (SELECT 1 FROM inventory WHERE _id = ?)`,
        [inv._id, clientInventoryId, inv._id]
      );
      db.run(
        `UPDATE inventory SET _id = ?, sync_status = 'SYNCED'
         WHERE _id != ? AND client_inventory_id = ?`,
        [inv._id, inv._id, clientInventoryId]
      );
    } catch (mergeErr) {
      console.warn("[Inventory cache] duplicate merge warning:", mergeErr?.message);
    }
  }
  db.run(`
    INSERT INTO inventory (_id, name, quantity, unit, min_limit, cost_price, last_restock_total_cost, last_restocked, updated_at, sync_status, client_inventory_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?)
    ON CONFLICT(_id) DO UPDATE SET
      name = excluded.name,
      quantity = excluded.quantity,
      unit = excluded.unit,
      min_limit = excluded.min_limit,
      cost_price = excluded.cost_price,
      last_restock_total_cost = excluded.last_restock_total_cost,
      last_restocked = excluded.last_restocked,
      updated_at = excluded.updated_at,
      client_inventory_id = COALESCE(excluded.client_inventory_id, inventory.client_inventory_id)
    WHERE IFNULL(inventory.sync_status, 'SYNCED') != 'PENDING_SYNC'
  `, [
    inv._id,
    inv.name,
    inv.quantity,
    inv.unit,
    inv.minLimit,
    inv.costPrice || 0,
    inv.lastRestockTotalCost || 0,
    inv.lastRestocked || "",
    inv.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
    clientInventoryId || null
  ]);
  return true;
}

// desktop/main/frontendUpdater.js
var import_fs3 = __toESM(require("fs"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_https2 = __toESM(require("https"), 1);
var import_electron2 = require("electron");
var TRUSTED_ORIGIN = "https://fishawy.vercel.app";
var MANIFEST_URL = `${TRUSTED_ORIGIN}/frontend-version.json`;
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = import_https2.default.get(url, { headers: { "Cache-Control": "no-cache", "User-Agent": "ElFishawyDesktop" } }, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.setTimeout(12e3, () => {
      req.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}
var FrontendUpdater = class {
  constructor() {
    this.userDataPath = import_electron2.app.getPath("userData");
    this.frontendBaseDir = import_path3.default.join(this.userDataPath, "app_frontend");
    this.currentLinkDir = import_path3.default.join(this.frontendBaseDir, "current");
    this.backupDir = import_path3.default.join(this.frontendBaseDir, "backup");
    this.stagingDir = import_path3.default.join(this.frontendBaseDir, "staging");
    this.versionsDir = import_path3.default.join(this.frontendBaseDir, "versions");
    this.metaFile = import_path3.default.join(this.frontendBaseDir, "meta.json");
    this.bundledFrontendDir = import_path3.default.join(import_electron2.app.getAppPath(), "dist");
    this.isUpdating = false;
    this.updateReady = false;
    this.newVersion = null;
    this.ensureDirectories();
  }
  ensureDirectories() {
    [this.frontendBaseDir, this.stagingDir, this.versionsDir, this.backupDir].forEach((dir) => {
      if (!import_fs3.default.existsSync(dir)) {
        import_fs3.default.mkdirSync(dir, { recursive: true });
      }
    });
  }
  getLocalMeta() {
    try {
      if (import_fs3.default.existsSync(this.metaFile)) {
        return JSON.parse(import_fs3.default.readFileSync(this.metaFile, "utf8"));
      }
    } catch (e) {
      console.error("[FrontendUpdater] Error reading local meta:", e);
    }
    return { version: "1.0.0", tag: "frontend-v1.0.0", activatedAt: null };
  }
  saveLocalMeta(meta) {
    try {
      import_fs3.default.writeFileSync(this.metaFile, JSON.stringify(meta, null, 2), "utf8");
    } catch (e) {
      console.error("[FrontendUpdater] Error saving local meta:", e);
    }
  }
  /**
   * Returns the path to the valid index.html to be loaded by Electron.
   * Priority:
   * 1. Latest verified & activated downloaded frontend in userData/app_frontend/current/index.html
   * 2. Fallback to bundled frontend shipped inside EXE dist/index.html
   */
  getFrontendIndexPath() {
    const customIndex = import_path3.default.join(this.currentLinkDir, "index.html");
    if (import_fs3.default.existsSync(customIndex)) {
      try {
        const stats = import_fs3.default.statSync(customIndex);
        if (stats.size > 200) {
          console.log("[FrontendUpdater] Using active downloaded frontend at:", customIndex);
          return customIndex;
        }
      } catch (err) {
        console.warn("[FrontendUpdater] Verified custom frontend corrupt, falling back:", err);
      }
    }
    const backupIndex = import_path3.default.join(this.backupDir, "index.html");
    if (import_fs3.default.existsSync(backupIndex)) {
      try {
        const stats = import_fs3.default.statSync(backupIndex);
        if (stats.size > 200) {
          console.log("[FrontendUpdater] Using safe backup frontend at:", backupIndex);
          return backupIndex;
        }
      } catch (err) {
        console.warn("[FrontendUpdater] Backup frontend check failed:", err);
      }
    }
    const fallbackPath = import_path3.default.join(this.bundledFrontendDir, "index.html");
    console.log("[FrontendUpdater] Using bundled fallback frontend at:", fallbackPath);
    return fallbackPath;
  }
  compareVersions(v1, v2) {
    const p1 = (v1 || "1.0.0").split(".").map(Number);
    const p2 = (v2 || "1.0.0").split(".").map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const num1 = p1[i] || 0;
      const num2 = p2[i] || 0;
      if (num2 > num1) return 1;
      if (num2 < num1) return -1;
    }
    return 0;
  }
  /**
   * Checks for remote version manifest in background.
   */
  async checkForUpdates(mainWindow2) {
    if (this.isUpdating) return { checking: false, message: "Update already in progress" };
    try {
      console.log("[FrontendUpdater] Checking remote manifest at:", MANIFEST_URL);
      let remoteManifest = null;
      try {
        const manifestBuf = await fetchBuffer(MANIFEST_URL);
        remoteManifest = JSON.parse(manifestBuf.toString("utf8"));
      } catch (e) {
        console.log("[FrontendUpdater] Remote manifest fetch skipped/offline:", e.message);
        return { hasUpdate: false, reason: "offline_or_not_found" };
      }
      if (!remoteManifest || !remoteManifest.version || !remoteManifest.files) {
        return { hasUpdate: false, reason: "invalid_manifest" };
      }
      const currentMeta = this.getLocalMeta();
      const remoteTag = remoteManifest.tag || `frontend-v${remoteManifest.version}`;
      const localTag = currentMeta.tag || `frontend-v${currentMeta.version}`;
      console.log(`[FrontendUpdater] Local: ${currentMeta.version} (${currentMeta.buildDate || "n/a"}) [${localTag}] | Remote: ${remoteManifest.version} (${remoteManifest.buildDate || "n/a"}) [${remoteTag}]`);
      const versionDiff = this.compareVersions(currentMeta.version, remoteManifest.version);
      const isNewerBuild = remoteManifest.buildDate && currentMeta.buildDate && remoteManifest.buildDate > currentMeta.buildDate;
      const isDifferentBuild = remoteManifest.buildDate && currentMeta.buildDate && remoteManifest.buildDate !== currentMeta.buildDate;
      const tagChanged = remoteTag && localTag && remoteTag !== localTag;
      const hasNewUpdate = versionDiff > 0 || isNewerBuild || isDifferentBuild || tagChanged;
      if (!hasNewUpdate) {
        console.log("[FrontendUpdater] Local frontend is up to date.");
        return { hasUpdate: false, currentVersion: currentMeta.version };
      }
      console.log(`[FrontendUpdater] Newer frontend discovered: ${remoteManifest.version}. Starting atomic download...`);
      this.isUpdating = true;
      if (mainWindow2 && !mainWindow2.isDestroyed()) {
        mainWindow2.webContents.send("frontend:update-downloading", { version: remoteManifest.version });
      }
      const success = await this.downloadAndApplyUpdate(remoteManifest);
      this.isUpdating = false;
      if (success) {
        this.updateReady = true;
        this.newVersion = remoteManifest.version;
        console.log(`[FrontendUpdater] Frontend ${remoteManifest.version} safely downloaded and ready.`);
        if (mainWindow2 && !mainWindow2.isDestroyed()) {
          mainWindow2.webContents.send("frontend:update-ready", {
            version: remoteManifest.version,
            message: "\u062A\u0645 \u062A\u062D\u0645\u064A\u0644 \u0623\u062D\u062F\u062B \u0646\u0633\u062E\u0629 \u0645\u0646 \u0627\u0644\u0645\u0646\u0635\u0629 \u0628\u0646\u062C\u0627\u062D\u060C \u062C\u0627\u0631\u064A \u062A\u0641\u0639\u064A\u0644\u0647\u0627 \u0641\u0648\u0631\u0627\u064B..."
          });
          setTimeout(() => {
            if (mainWindow2 && !mainWindow2.isDestroyed()) {
              const newIndex = this.getFrontendIndexPath();
              console.log("[FrontendUpdater] Live-reloading main window with:", newIndex);
              mainWindow2.loadFile(newIndex);
            }
          }, 1500);
        }
        return { hasUpdate: true, version: remoteManifest.version, ready: true };
      } else {
        return { hasUpdate: false, reason: "download_validation_failed" };
      }
    } catch (err) {
      this.isUpdating = false;
      console.error("[FrontendUpdater] Check for updates error:", err);
      return { hasUpdate: false, error: err.message };
    }
  }
  async downloadAndApplyUpdate(manifest) {
    const versionDir = import_path3.default.join(this.versionsDir, `v_${manifest.version}`);
    try {
      if (import_fs3.default.existsSync(this.stagingDir)) {
        import_fs3.default.rmSync(this.stagingDir, { recursive: true, force: true });
      }
      import_fs3.default.mkdirSync(this.stagingDir, { recursive: true });
      for (const relativePath of manifest.files) {
        const normalized = import_path3.default.normalize(relativePath).replace(/^(\.\.[\/\\])+/, "");
        if (normalized.startsWith("..")) {
          throw new Error(`Suspicious file path in manifest: ${relativePath}`);
        }
        const targetFilePath = import_path3.default.join(this.stagingDir, normalized);
        const targetFileDir = import_path3.default.dirname(targetFilePath);
        if (!import_fs3.default.existsSync(targetFileDir)) {
          import_fs3.default.mkdirSync(targetFileDir, { recursive: true });
        }
        const fileUrl = `${TRUSTED_ORIGIN}/${normalized.replace(/\\/g, "/")}`;
        const buffer = await fetchBuffer(fileUrl);
        import_fs3.default.writeFileSync(targetFilePath, buffer);
      }
      const stagedIndex = import_path3.default.join(this.stagingDir, "index.html");
      if (!import_fs3.default.existsSync(stagedIndex) || import_fs3.default.statSync(stagedIndex).size < 200) {
        throw new Error("Downloaded bundle is missing valid index.html");
      }
      try {
        let indexContent = import_fs3.default.readFileSync(stagedIndex, "utf8");
        indexContent = indexContent.replace(/(src|href)=["']\/assets\//g, '$1="./assets/').replace(/(src|href)=["']\/favicon\./g, '$1="./favicon.').replace(/(src|href)=["']\/manifest\.json["']/g, '$1="./manifest.json"');
        import_fs3.default.writeFileSync(stagedIndex, indexContent, "utf8");
        console.log("[FrontendUpdater] Normalized index.html asset paths to relative paths.");
      } catch (err) {
        console.warn("[FrontendUpdater] Could not normalize index.html paths:", err);
      }
      if (import_fs3.default.existsSync(versionDir)) {
        import_fs3.default.rmSync(versionDir, { recursive: true, force: true });
      }
      import_fs3.default.renameSync(this.stagingDir, versionDir);
      if (import_fs3.default.existsSync(this.currentLinkDir)) {
        try {
          if (import_fs3.default.existsSync(this.backupDir)) {
            import_fs3.default.rmSync(this.backupDir, { recursive: true, force: true });
          }
          this.copyDirRecursive(this.currentLinkDir, this.backupDir);
        } catch (bkErr) {
          console.warn("[FrontendUpdater] Backup warning (non-fatal):", bkErr);
        }
      }
      const tempActiveDir = import_path3.default.join(this.frontendBaseDir, "temp_current");
      if (import_fs3.default.existsSync(tempActiveDir)) {
        import_fs3.default.rmSync(tempActiveDir, { recursive: true, force: true });
      }
      this.copyDirRecursive(versionDir, tempActiveDir);
      try {
        if (import_fs3.default.existsSync(this.currentLinkDir)) {
          import_fs3.default.rmSync(this.currentLinkDir, { recursive: true, force: true });
        }
        import_fs3.default.renameSync(tempActiveDir, this.currentLinkDir);
      } catch (swapErr) {
        console.error("[FrontendUpdater] Swap failed, rolling back to backup:", swapErr);
        if (import_fs3.default.existsSync(this.backupDir)) {
          this.copyDirRecursive(this.backupDir, this.currentLinkDir);
        }
        throw swapErr;
      }
      this.saveLocalMeta({
        version: manifest.version,
        tag: manifest.tag || `frontend-v${manifest.version}`,
        buildDate: manifest.buildDate || (/* @__PURE__ */ new Date()).toISOString(),
        activatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      return true;
    } catch (err) {
      console.error("[FrontendUpdater] Atomic update failed, keeping current frontend intact:", err);
      if (import_fs3.default.existsSync(this.stagingDir)) {
        try {
          import_fs3.default.rmSync(this.stagingDir, { recursive: true, force: true });
        } catch {
        }
      }
      return false;
    }
  }
  copyDirRecursive(src, dest) {
    import_fs3.default.mkdirSync(dest, { recursive: true });
    const entries = import_fs3.default.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = import_path3.default.join(src, entry.name);
      const destPath = import_path3.default.join(dest, entry.name);
      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath);
      } else {
        import_fs3.default.copyFileSync(srcPath, destPath);
      }
    }
  }
  applyUpdateNow(mainWindow2) {
    if (!this.updateReady) return false;
    const newIndexPath = this.getFrontendIndexPath();
    if (mainWindow2 && !mainWindow2.isDestroyed()) {
      mainWindow2.loadFile(newIndexPath);
      return true;
    }
    return false;
  }
};
var frontendUpdater = new FrontendUpdater();

// desktop/main/offlineInventoryOps.js
var rows = (db, sql, params = []) => {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  return result[0].values.map((values) => {
    const row = {};
    result[0].columns.forEach((column, index) => {
      row[column] = values[index];
    });
    return row;
  });
};
var transaction = (db, operation) => {
  db.run("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.run("COMMIT");
    return result;
  } catch (err) {
    try {
      db.run("ROLLBACK");
    } catch {
    }
    throw err;
  }
};
var newId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
var findInventoryRow = (db, id) => rows(
  db,
  "SELECT * FROM inventory WHERE _id = ? OR client_inventory_id = ? LIMIT 1",
  [String(id || ""), String(id || "")]
)[0];
var inventoryRowPayload = (item) => ({
  _id: item._id,
  clientInventoryId: item.client_inventory_id || item._id,
  name: item.name,
  quantity: Number(item.quantity) || 0,
  unit: item.unit || "KG",
  minLimit: Number(item.min_limit) || 5,
  costPrice: Number(item.cost_price) || 0,
  lastRestockTotalCost: Number(item.last_restock_total_cost) || 0,
  lastRestocked: item.last_restocked,
  syncStatus: item.sync_status || "SYNCED",
  isOffline: (item.sync_status || "SYNCED") === "PENDING_SYNC"
});
var inventoryPayload = (item) => ({
  name: item.name,
  quantity: Number(item.quantity) || 0,
  unit: item.unit || "KG",
  minLimit: item.min_limit !== void 0 ? Number(item.min_limit) : 5,
  costPrice: Number(item.cost_price) || 0,
  totalCost: Number(item.last_restock_total_cost) || 0,
  clientInventoryId: item.client_inventory_id || item._id
});
var expensePayload = (expense) => ({
  _id: expense._id,
  description: expense.description || "",
  amount: Number(expense.amount) || 0,
  category: expense.category || "inventory",
  inventoryItemLinked: expense.inventory_item_linked || void 0,
  inventoryQuantityAdded: Number(expense.inventory_quantity_added) || void 0,
  unitCost: Number(expense.unit_cost) || void 0,
  purchaseNumber: expense.purchase_number || void 0,
  addedBy: expense.added_by || "",
  date: expense.date || expense.created_at || (/* @__PURE__ */ new Date()).toISOString(),
  syncStatus: expense.sync_status || "PENDING_SYNC",
  clientExpenseId: expense.client_expense_id || expense._id,
  createdAt: expense.created_at || expense.date || (/* @__PURE__ */ new Date()).toISOString(),
  isOffline: expense.sync_status !== "SYNCED"
});
var ensureQueueEntry = (db, clientOpId, enqueue, operation) => {
  const existing = rows(db, "SELECT id FROM sync_queue WHERE client_op_id = ? LIMIT 1", [clientOpId]);
  if (existing.length) return false;
  enqueue(operation);
  return true;
};
function createOfflineInventoryItem(db, itemData, enqueue) {
  const clientInventoryId = itemData.clientInventoryId || newId("off_inv");
  const existing = rows(
    db,
    "SELECT * FROM inventory WHERE _id = ? OR client_inventory_id = ? LIMIT 1",
    [clientInventoryId, clientInventoryId]
  )[0];
  if (existing) {
    const pending = (existing.sync_status || "SYNCED") === "PENDING_SYNC";
    const queued = pending && transaction(db, () => ensureQueueEntry(db, clientInventoryId, enqueue, {
      clientOpId: clientInventoryId,
      entityType: "inventory_create",
      action: "CREATE",
      payload: inventoryPayload(existing),
      createdAt: existing.updated_at || (/* @__PURE__ */ new Date()).toISOString()
    }));
    return {
      success: true,
      queued,
      data: inventoryRowPayload(existing)
    };
  }
  const now = itemData.date || (/* @__PURE__ */ new Date()).toISOString();
  const quantity = Number(itemData.quantity) || 0;
  const minLimit = itemData.minLimit !== void 0 ? Number(itemData.minLimit) : 5;
  const totalCost = itemData.totalCost !== void 0 ? Number(itemData.totalCost) || 0 : Number(((Number(itemData.costPrice) || 0) * quantity).toFixed(2));
  const costPrice = quantity > 0 && totalCost > 0 ? Number((totalCost / quantity).toFixed(2)) : Number(itemData.costPrice) || 0;
  const name = String(itemData.name || "").trim();
  const unit = String(itemData.unit || "KG");
  const sameNameRow = rows(
    db,
    "SELECT * FROM inventory WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1",
    [name]
  )[0];
  if (sameNameRow) {
    return {
      success: false,
      queued: false,
      existing: true,
      message: "\u0627\u0644\u0635\u0646\u0641 \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0641\u0639\u0644. \u0627\u062E\u062A\u0631 \u0627\u0644\u0635\u0646\u0641 \u0627\u0644\u0645\u0648\u062C\u0648\u062F \u0648\u0633\u062C\u0651\u0644 \u062A\u0648\u0631\u064A\u062F\u064B\u0627 \u0628\u0645\u0639\u0631\u0651\u0641\u0647 \u0628\u062F\u0644 \u0625\u0646\u0634\u0627\u0621 \u0635\u0646\u0641 \u0628\u0627\u0644\u0627\u0633\u0645 \u0646\u0641\u0633\u0647.",
      data: inventoryRowPayload(sameNameRow)
    };
  }
  transaction(db, () => {
    db.run(`
      INSERT INTO inventory (_id, name, quantity, unit, min_limit, cost_price, last_restock_total_cost, last_restocked, updated_at, sync_status, client_inventory_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_SYNC', ?)
    `, [clientInventoryId, name, quantity, unit, minLimit, costPrice, totalCost, now, now, clientInventoryId]);
    enqueue({
      clientOpId: clientInventoryId,
      entityType: "inventory_create",
      action: "CREATE",
      payload: { name, quantity, unit, minLimit, costPrice, totalCost, clientInventoryId },
      createdAt: now
    });
    if (quantity > 0) {
      const openingExpenseId = `${clientInventoryId}:opening`;
      const openingUnitCost = totalCost > 0 ? Number((totalCost / quantity).toFixed(2)) : 0;
      db.run(`
                INSERT INTO expenses (_id, description, amount, category, inventory_item_linked, inventory_quantity_added, unit_cost, date, added_by, sync_status, client_expense_id, created_at)
                VALUES (?, ?, ?, 'inventory', ?, ?, ?, ?, ?, 'PENDING_SYNC', ?, ?)
            `, [openingExpenseId, `\u0631\u0635\u064A\u062F \u0627\u0641\u062A\u062A\u0627\u062D\u064A: ${name} - \u0643\u0645\u064A\u0629: ${quantity} ${unit}`, totalCost, clientInventoryId, quantity, openingUnitCost, now, itemData.addedBy || "", openingExpenseId, now]);
    }
  });
  return {
    success: true,
    queued: true,
    data: {
      _id: clientInventoryId,
      clientInventoryId,
      name,
      quantity,
      unit,
      minLimit,
      costPrice,
      lastRestockTotalCost: totalCost,
      lastRestocked: now,
      syncStatus: "PENDING_SYNC",
      isOffline: true
    }
  };
}
function createOfflineExpense(db, expenseData, enqueue) {
  const clientExpenseId = expenseData.clientExpenseId || newId("off_exp");
  const existing = rows(db, "SELECT * FROM expenses WHERE client_expense_id = ? OR _id = ? LIMIT 1", [clientExpenseId, clientExpenseId])[0];
  if (existing) {
    const pending = (existing.sync_status || "SYNCED") === "PENDING_SYNC";
    const queued = pending && transaction(db, () => ensureQueueEntry(db, clientExpenseId, enqueue, {
      clientOpId: clientExpenseId,
      entityType: "expense",
      action: "CREATE",
      payload: expenseData,
      createdAt: existing.created_at || existing.date || (/* @__PURE__ */ new Date()).toISOString()
    }));
    return { success: true, queued, data: expensePayload(existing) };
  }
  const now = expenseData.date || (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const amount = Number(expenseData.amount) || 0;
  const totalCost = Number(expenseData.totalCost ?? amount) || 0;
  const quantity = Number(expenseData.inventoryQuantityAdded) || 0;
  const unitCost = quantity > 0 && totalCost > 0 ? Number((totalCost / quantity).toFixed(2)) : 0;
  const category = expenseData.category || "inventory";
  transaction(db, () => {
    db.run(`
      INSERT INTO expenses (_id, description, amount, category, inventory_item_linked, inventory_quantity_added, unit_cost, date, added_by, sync_status, client_expense_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_SYNC', ?, ?)
    `, [clientExpenseId, expenseData.description, amount, category, expenseData.inventoryItemLinked || null, quantity || null, unitCost, now, expenseData.addedBy || "", clientExpenseId, createdAt]);
    if (category === "inventory" && expenseData.inventoryItemLinked) {
      db.run(`
        UPDATE inventory
        SET quantity = quantity + ?,
            cost_price = CASE WHEN ? > 0 THEN ? ELSE cost_price END,
            last_restock_total_cost = ?,
            last_restocked = ?,
            updated_at = ?,
            sync_status = 'PENDING_SYNC'
        WHERE _id = ?
      `, [quantity, unitCost, unitCost, totalCost, now, now, expenseData.inventoryItemLinked]);
    }
    enqueue({
      clientOpId: clientExpenseId,
      entityType: "expense",
      action: "CREATE",
      payload: { ...expenseData, clientExpenseId },
      createdAt
    });
  });
  return {
    success: true,
    queued: true,
    data: {
      _id: clientExpenseId,
      description: expenseData.description,
      amount,
      category,
      inventoryItemLinked: expenseData.inventoryItemLinked,
      inventoryQuantityAdded: quantity,
      unitCost,
      date: now,
      createdAt: now,
      syncStatus: "PENDING_SYNC",
      clientExpenseId,
      isOffline: true
    }
  };
}
function listOfflineExpenses(db) {
  try {
    const result = db.exec(`
            SELECT e.*,
                   i.name   AS inv_name,
                   i.unit   AS inv_unit,
                   i._id    AS inv_resolved_id
            FROM expenses e
            LEFT JOIN inventory i ON i._id = e.inventory_item_linked
            ORDER BY e.date DESC, e.created_at DESC
        `);
    if (!result.length) return [];
    return result[0].values.map((values) => {
      const raw = {};
      result[0].columns.forEach((col, idx) => {
        raw[col] = values[idx];
      });
      const exp = expensePayload(raw);
      if (raw.inv_resolved_id && raw.inv_name) {
        exp.inventoryItemLinked = {
          _id: raw.inv_resolved_id,
          name: raw.inv_name,
          unit: raw.inv_unit || "\u0648\u062D\u062F\u0629"
        };
      }
      return exp;
    });
  } catch {
    return rows(db, "SELECT * FROM expenses ORDER BY date DESC, created_at DESC").map(expensePayload);
  }
}
function restockOfflineInventory(db, restockData, enqueue) {
  const clientRestockId = restockData.clientRestockId || newId("off_rstk");
  const targetId = String(restockData.id || restockData._id || restockData.inventoryId || "");
  if (!targetId) return { success: false, message: "Missing inventory item id" };
  const priorExpense = rows(db, "SELECT * FROM expenses WHERE client_expense_id = ? LIMIT 1", [clientRestockId])[0];
  if (priorExpense) {
    const pending = (priorExpense.sync_status || "SYNCED") === "PENDING_SYNC";
    const queued = pending && transaction(db, () => ensureQueueEntry(db, clientRestockId, enqueue, {
      clientOpId: clientRestockId,
      entityType: "inventory_restock",
      action: "UPDATE",
      payload: { ...restockData, id: targetId, clientRestockId },
      createdAt: priorExpense.created_at || priorExpense.date || (/* @__PURE__ */ new Date()).toISOString()
    }));
    return { success: true, duplicate: true, queued, data: expensePayload(priorExpense), clientRestockId };
  }
  const priorQueue = rows(db, "SELECT status FROM sync_queue WHERE client_op_id = ? LIMIT 1", [clientRestockId])[0];
  if (priorQueue) {
    let repairedLedger = false;
    if (["PENDING", "FAILED"].includes(priorQueue.status)) {
      const item2 = findInventoryRow(db, targetId);
      if (item2) {
        const quantity2 = Number(restockData.quantity) || 0;
        const totalCost2 = Number(restockData.totalCost ?? (Number(restockData.costPrice) || 0) * quantity2) || 0;
        const now2 = restockData.date || (/* @__PURE__ */ new Date()).toISOString();
        const unitCost2 = quantity2 > 0 ? Number((totalCost2 / quantity2).toFixed(2)) : 0;
        transaction(db, () => db.run(`
          INSERT INTO expenses (_id, description, amount, category, inventory_item_linked, inventory_quantity_added, unit_cost, date, added_by, sync_status, client_expense_id, created_at)
          VALUES (?, ?, ?, 'inventory', ?, ?, ?, ?, ?, 'PENDING_SYNC', ?, ?)
        `, [clientRestockId, restockData.description || `\u062A\u0648\u0631\u064A\u062F \u0645\u062E\u0632\u0648\u0646: ${item2.name} - \u0643\u0645\u064A\u0629: ${quantity2} ${item2.unit}`, totalCost2, item2._id, quantity2, unitCost2, now2, restockData.addedBy || "", clientRestockId, now2]));
        repairedLedger = true;
      }
    }
    return { success: true, duplicate: true, queued: repairedLedger, clientRestockId };
  }
  const item = findInventoryRow(db, targetId);
  if (!item) return { success: false, message: "\u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0645\u062E\u0632\u0646 \u0627\u0644\u0645\u062D\u0644\u064A \u2014 \u062D\u062F\u0651\u062B \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0631\u0629 \u0648\u0627\u062D\u062F\u0629 \u0648\u0647\u0648 \u0645\u062A\u0635\u0644 \u0628\u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A" };
  const localRowId = String(item._id);
  const quantity = Number(restockData.quantity) || 0;
  const totalCost = Number(restockData.totalCost ?? (Number(restockData.costPrice) || 0) * quantity) || 0;
  const unitCost = quantity > 0 ? Number((totalCost / quantity).toFixed(2)) : Number(restockData.costPrice) || 0;
  const now = restockData.date || (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const description = restockData.description || `\u062A\u0648\u0631\u064A\u062F \u0645\u062E\u0632\u0648\u0646: ${item.name} - \u0643\u0645\u064A\u0629: ${quantity} ${item.unit}`;
  transaction(db, () => {
    db.run(`
      UPDATE inventory
      SET quantity = quantity + ?,
          cost_price = CASE WHEN ? > 0 THEN ? ELSE cost_price END,
          last_restock_total_cost = ?,
          last_restocked = ?,
          updated_at = ?,
          sync_status = 'PENDING_SYNC'
      WHERE _id = ?
    `, [quantity, unitCost, unitCost, totalCost, now, now, localRowId]);
    db.run(`
      INSERT INTO expenses (_id, description, amount, category, inventory_item_linked, inventory_quantity_added, unit_cost, date, added_by, sync_status, client_expense_id, created_at)
      VALUES (?, ?, ?, 'inventory', ?, ?, ?, ?, ?, 'PENDING_SYNC', ?, ?)
    `, [clientRestockId, description, totalCost, localRowId, quantity, unitCost, now, restockData.addedBy || "", clientRestockId, createdAt]);
    enqueue({
      clientOpId: clientRestockId,
      entityType: "inventory_restock",
      action: "UPDATE",
      payload: { ...restockData, id: localRowId, totalCost, clientRestockId },
      createdAt
    });
  });
  return {
    success: true,
    queued: true,
    clientRestockId,
    data: {
      _id: clientRestockId,
      description,
      amount: totalCost,
      category: "inventory",
      inventoryItemLinked: localRowId,
      inventoryQuantityAdded: quantity,
      unitCost,
      date: now,
      createdAt: now,
      syncStatus: "PENDING_SYNC",
      clientExpenseId: clientRestockId,
      isOffline: true
    }
  };
}

// desktop/main/ipc.js
var import_crypto2 = __toESM(require("crypto"), 1);
var import_child_process = require("child_process");
var import_util = require("util");
var execFileAsync = (0, import_util.promisify)(import_child_process.execFile);
var CAIRO_TIMEZONE = "Africa/Cairo";
var getBusinessDayKey = (date = /* @__PURE__ */ new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: CAIRO_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
};
var cairoOffsetMinutes = (date) => {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: CAIRO_TIMEZONE,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const parts = {};
    for (const p of dtf.formatToParts(date)) {
      if (p.type !== "literal") parts[p.type] = p.value;
    }
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second)
    );
    return Math.round((asUtc - date.getTime()) / 6e4);
  } catch {
    return 120;
  }
};
var getBusinessDayStartIso = (dayKey) => {
  const [y, m, d] = String(dayKey).split("-").map(Number);
  const noonGuess = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
  const offsetMin = cairoOffsetMinutes(noonGuess);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0) - offsetMin * 6e4).toISOString();
};
var allocateProvisionalNumber = (db, businessDayKey) => {
  const counterId = `provisional_${businessDayKey}`;
  try {
    let maxProvisional2 = 0;
    try {
      const maxRes = db.exec(
        `SELECT MAX(CAST(provisional_number AS INTEGER)) AS max_num
         FROM orders
         WHERE provisional_number NOT GLOB '*[^0-9]*'
           AND LENGTH(provisional_number) <= 6
           AND CAST(provisional_number AS INTEGER) > 0
           AND (day_key = ? OR (day_key IS NULL AND created_at >= ?))`,
        [businessDayKey, getBusinessDayStartIso(businessDayKey)]
      );
      maxProvisional2 = maxRes.length && maxRes[0].values.length ? Number(maxRes[0].values[0][0]) || 0 : 0;
    } catch {
      maxProvisional2 = 0;
    }
    db.run(
      `INSERT INTO local_counters (_id, seq) VALUES (?, ?)
       ON CONFLICT(_id) DO UPDATE SET seq = MAX(local_counters.seq, excluded.seq)`,
      [counterId, maxProvisional2]
    );
    db.run(`UPDATE local_counters SET seq = seq + 1 WHERE _id = ?`, [counterId]);
    const res = db.exec(`SELECT seq FROM local_counters WHERE _id = ?`, [counterId]);
    const seq = res.length && res[0].values.length ? Number(res[0].values[0][0]) || 1 : 1;
    return String(seq > 0 ? seq : 1);
  } catch {
    return String((maxProvisional || 0) + 1);
  }
};
var CONVERSION_TO_BASE = {
  KG: 1e3,
  GRAM: 1,
  LITER: 1e3,
  ML: 1,
  PIECE: 1,
  SPOON: 5
};
var convertToBase = (quantity, unit) => {
  const factor = CONVERSION_TO_BASE[String(unit || "").toUpperCase()] || 1;
  return quantity * factor;
};
var baseToUnit = (baseQty, unit) => {
  const u = String(unit || "").toUpperCase();
  if (u === "KG") return baseQty / 1e3;
  if (u === "GRAM") return baseQty;
  if (u === "LITER") return baseQty / 1e3;
  if (u === "ML") return baseQty;
  if (u === "PIECE") return baseQty;
  if (u === "SPOON") return baseQty / 5;
  return baseQty;
};
var consumptionPerUnit = (inputQuantity, inputUnit, outputQuantity) => {
  const baseInputQty = convertToBase(inputQuantity, inputUnit);
  return baseInputQty / (outputQuantity || 1);
};
var lookupProduct = (db, productId) => {
  if (!productId) return null;
  try {
    const pRes = db.exec(`SELECT name, price FROM products WHERE _id = ?`, [String(productId)]);
    if (pRes.length && pRes[0].values.length) {
      return {
        _id: String(productId),
        name: pRes[0].values[0][0] || "\u0645\u0634\u0631\u0648\u0628",
        price: Number(pRes[0].values[0][1]) || 0
      };
    }
  } catch {
  }
  return null;
};
var slimOrderItems = (items, db) => {
  let parsed = items;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((it) => {
    const pid = typeof it?.product === "object" && it.product ? it.product._id || it.product.id : it?.product;
    const fromObjName = typeof it?.product === "object" ? it.product?.name : "";
    const cached = pid ? lookupProduct(db, pid) : null;
    const name = fromObjName || it?.productName || cached?.name || "\u0645\u0634\u0631\u0648\u0628";
    const price = Number(it?.price) || Number(typeof it?.product === "object" ? it.product?.price : 0) || Number(cached?.price) || 0;
    return {
      product: { _id: pid || "", name, price },
      quantity: Number(it?.quantity) || 0,
      price
    };
  });
};
var mapOrderRow = (raw, db) => {
  const createdAt = raw.created_at || raw.createdAt || (/* @__PURE__ */ new Date()).toISOString();
  return {
    _id: raw._id,
    orderNumber: raw.order_number || raw.orderNumber || "",
    provisionalNumber: raw.provisional_number || raw.provisionalNumber || "",
    dayKey: raw.day_key || raw.dayKey || null,
    items: slimOrderItems(raw.items, db),
    totalAmount: Number(raw.total_amount ?? raw.totalAmount) || 0,
    status: raw.status || "completed",
    tableNumber: raw.table_number ?? raw.tableNumber ?? null,
    cashierId: raw.cashier_id || raw.cashierId || "",
    notes: raw.notes || "",
    syncStatus: raw.sync_status || raw.syncStatus || "SYNCED",
    clientOrderId: raw.client_order_id || raw.clientOrderId,
    createdAt,
    updatedAt: raw.updated_at || raw.updatedAt || createdAt
  };
};
var upsertSyncedOrder = (db, ord) => {
  if (!ord || !ord._id) return;
  const createdAt = ord.createdAt || ord.created_at || (/* @__PURE__ */ new Date()).toISOString();
  const updatedAt = ord.updatedAt || ord.updated_at || createdAt;
  const rawNum = String(ord.orderNumber || ord.order_number || "").trim();
  const orderNumber = /^\d{1,6}$/.test(rawNum) ? rawNum : null;
  const tableNumber = ord.tableNumber ?? ord.table_number ?? null;
  const cashierId = typeof ord.cashierId === "object" ? ord.cashierId?._id || "" : ord.cashierId || "";
  const clientOrderId = ord.clientOrderId || ord.client_order_id || null;
  const dayKey = ord.dayKey || ord.day_key || null;
  const itemsJson = JSON.stringify(ord.items || []);
  try {
    const existing = db.exec(`SELECT sync_status FROM orders WHERE _id = ?`, [ord._id]);
    if (existing.length && existing[0].values.length && existing[0].values[0][0] === "PENDING_SYNC") {
      return;
    }
  } catch {
  }
  if (clientOrderId) {
    try {
      db.run(`DELETE FROM orders WHERE client_order_id = ? AND _id != ?`, [clientOrderId, ord._id]);
    } catch {
    }
  }
  try {
    db.run(`
    INSERT INTO orders (_id, order_number, day_key, items, total_amount, status, table_number, cashier_id, notes, sync_status, client_order_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?, ?)
    ON CONFLICT(_id) DO UPDATE SET
      order_number = COALESCE(excluded.order_number, orders.order_number),
      day_key = COALESCE(excluded.day_key, orders.day_key),
      items = excluded.items,
      total_amount = excluded.total_amount,
      status = excluded.status,
      table_number = excluded.table_number,
      cashier_id = excluded.cashier_id,
      notes = excluded.notes,
      client_order_id = COALESCE(excluded.client_order_id, orders.client_order_id),
      created_at = COALESCE(orders.created_at, excluded.created_at),
      updated_at = excluded.updated_at
    WHERE IFNULL(orders.sync_status, 'SYNCED') != 'PENDING_SYNC'
  `, [
      ord._id,
      orderNumber,
      dayKey,
      itemsJson,
      Number(ord.totalAmount ?? ord.total_amount) || 0,
      ord.status || "completed",
      tableNumber,
      cashierId,
      ord.notes || "",
      clientOrderId,
      createdAt,
      updatedAt
    ]);
  } catch (upsertErr) {
    db.run(`
      INSERT OR REPLACE INTO orders (_id, order_number, day_key, items, total_amount, status, table_number, cashier_id, notes, sync_status, client_order_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?, ?, ?)
    `, [
      ord._id,
      orderNumber,
      dayKey,
      itemsJson,
      Number(ord.totalAmount ?? ord.total_amount) || 0,
      ord.status || "completed",
      tableNumber,
      cashierId,
      ord.notes || "",
      clientOrderId,
      createdAt,
      updatedAt
    ]);
  }
};
function enqueueSecureOperation(db, { clientOpId, entityType, action, payload, createdAt }) {
  const masterKey2 = getMasterKey();
  const lastRes = db.exec(`SELECT sequence_id, op_hash FROM sync_queue ORDER BY id DESC LIMIT 1`);
  let nextSeq = 1;
  let prevHash = "ROOT_GENESIS";
  if (lastRes.length && lastRes[0].values.length) {
    const lastRow = lastRes[0].values[0];
    nextSeq = (Number(lastRow[0]) || 0) + 1;
    prevHash = String(lastRow[1] || "ROOT_GENESIS");
  }
  const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
  const opHash = masterKey2 ? computeOpHash(masterKey2, { sequenceId: nextSeq, clientOpId, entityType, action, payload: payloadStr, prevHash }) : "";
  db.run(`
    INSERT INTO sync_queue (client_op_id, entity_type, action, payload, status, sequence_id, prev_hash, op_hash, created_at)
    VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
  `, [clientOpId, entityType, action, payloadStr, nextSeq, prevHash, opHash, createdAt]);
}
function setupIpcHandlers(mainWindow2) {
  import_electron3.ipcMain.handle("app:check-online", async () => {
    try {
      const healthUrl = process.env.ELECTRON_TEST_MODE === "true" ? `${process.env.ELECTRON_TEST_API_URL}/` : "https://elfishawy-cafe-server.vercel.app/";
      const res = await httpFetch(healthUrl, {
        method: "GET",
        signal: AbortSignal.timeout(4e3)
      }).catch(() => null);
      return Boolean(res);
    } catch {
      return false;
    }
  });
  import_electron3.ipcMain.handle("auth:set-token", async (_event, token) => {
    configureSync({ token });
    return { success: true };
  });
  import_electron3.ipcMain.handle("db:query", async (_event, { sql, params }) => {
    try {
      const db = getDb();
      const res = db.exec(sql, params || []);
      if (!res.length) return [];
      const { columns, values } = res[0];
      return values.map((row) => {
        const obj = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    } catch (err) {
      console.error("db:query error:", err);
      throw err;
    }
  });
  import_electron3.ipcMain.handle("db:execute", async (_event, { sql, params }) => {
    try {
      const db = getDb();
      db.run(sql, params || []);
      saveDatabase();
      return { success: true };
    } catch (err) {
      console.error("db:execute error:", err);
      throw err;
    }
  });
  import_electron3.ipcMain.handle("offline:create-order", async (_event, orderData) => {
    try {
      const db = getDb();
      const clientOrderId = orderData.clientOrderId || `off_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
      try {
        const existingRes = db.exec(
          `SELECT * FROM orders WHERE client_order_id = ? OR _id = ? LIMIT 1`,
          [clientOrderId, clientOrderId]
        );
        if (existingRes.length && existingRes[0].values.length) {
          const raw = {};
          existingRes[0].columns.forEach((col, idx) => {
            raw[col] = existingRes[0].values[0][idx];
          });
          return { success: true, data: mapOrderRow(raw, db) };
        }
      } catch {
      }
      db.run("BEGIN IMMEDIATE");
      let localOrderCommitted = false;
      try {
        const businessDayKey = getBusinessDayKey(/* @__PURE__ */ new Date());
        const tempOrderNumber = allocateProvisionalNumber(db, businessDayKey);
        const now = (/* @__PURE__ */ new Date()).toISOString();
        let totalAmount = 0;
        const processedItems = [];
        for (const it of orderData.items) {
          const productId = typeof it.product === "object" ? it.product?._id || it.product?.id : it.product;
          const cached = lookupProduct(db, productId);
          let price = Number(it.price) || Number(cached?.price) || 0;
          const name = typeof it.product === "object" && it.product?.name || cached?.name || "\u0645\u0634\u0631\u0648\u0628";
          totalAmount += price * it.quantity;
          processedItems.push({
            product: { _id: productId, name, price },
            quantity: it.quantity,
            price
          });
        }
        db.run(`
        INSERT INTO orders (_id, order_number, provisional_number, day_key, items, total_amount, status, table_number, cashier_id, notes, sync_status, client_order_id, created_at, updated_at)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_SYNC', ?, ?, ?)
      `, [
          clientOrderId,
          tempOrderNumber,
          businessDayKey,
          JSON.stringify(processedItems),
          totalAmount,
          "completed",
          orderData.tableNumber,
          orderData.cashierId || "",
          orderData.notes || "",
          clientOrderId,
          now,
          now
        ]);
        for (const it of processedItems) {
          const productId = typeof it.product === "object" ? it.product._id : it.product;
          db.run(
            `UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?), in_stock = CASE WHEN stock_quantity - ? > 0 THEN 1 ELSE 0 END WHERE _id = ?`,
            [it.quantity, it.quantity, productId]
          );
        }
        for (const it of processedItems) {
          const productId = typeof it.product === "object" ? it.product._id : it.product;
          const rRes = db.exec(`SELECT ingredients FROM recipes WHERE product_id = ? AND is_active = 1`, [productId]);
          if (rRes.length && rRes[0].values.length) {
            try {
              const ingredients = JSON.parse(rRes[0].values[0][0]);
              for (const ing of ingredients) {
                const invItemId = typeof ing.inventoryItem === "string" ? ing.inventoryItem : ing.inventoryItem?._id;
                if (!invItemId) continue;
                const invRes = db.exec(`SELECT quantity, unit FROM inventory WHERE _id = ?`, [invItemId]);
                if (invRes.length && invRes[0].values.length) {
                  const currentQty = Number(invRes[0].values[0][0]) || 0;
                  const unit = invRes[0].values[0][1];
                  const cpu = consumptionPerUnit(Number(ing.inputQuantity) || 0, ing.inputUnit, Number(ing.outputQuantity) || 1);
                  const totalConsumptionBase = cpu * it.quantity;
                  const currentStockBase = convertToBase(currentQty, unit);
                  const newStockBase = Math.max(0, currentStockBase - totalConsumptionBase);
                  const newQuantityInUnit = baseToUnit(newStockBase, unit);
                  db.run(`UPDATE inventory SET quantity = ? WHERE _id = ?`, [newQuantityInUnit, invItemId]);
                }
              }
            } catch (e) {
              console.warn("Recipe parse error in offline order:", e);
            }
          }
        }
        enqueueSecureOperation(db, {
          clientOpId: clientOrderId,
          entityType: "order",
          action: "CREATE",
          payload: {
            ...orderData,
            // لا نرسل أي رقم للسيرفر: الرقم النهائي يُصدره السيرفر فقط من العداد الذري.
            createdAt: now
          },
          createdAt: now
        });
        db.run("COMMIT");
        localOrderCommitted = true;
        saveDatabase();
        return {
          success: true,
          data: {
            _id: clientOrderId,
            clientOrderId,
            orderNumber: "",
            provisionalNumber: tempOrderNumber,
            items: processedItems,
            totalAmount,
            status: "completed",
            tableNumber: orderData.tableNumber,
            notes: orderData.notes,
            syncStatus: "PENDING_SYNC",
            createdAt: now,
            updatedAt: now,
            isOffline: true
          }
        };
      } finally {
        if (!localOrderCommitted) {
          try {
            db.run("ROLLBACK");
          } catch {
          }
        }
      }
    } catch (err) {
      console.error("offline:create-order error:", err);
      return { success: false, message: err.message };
    }
  });
  import_electron3.ipcMain.handle("offline:reconcile-synced-order", async (_event, { clientOrderId, serverOrder }) => {
    try {
      const db = getDb();
      const ok = reconcileOrderWithServer(db, clientOrderId, serverOrder);
      if (ok) saveDatabase();
      return { success: ok };
    } catch (err) {
      console.error("offline:reconcile-synced-order error:", err);
      return { success: false, message: err.message };
    }
  });
  import_electron3.ipcMain.handle("offline:get-orders", async () => {
    try {
      const db = getDb();
      const res = db.exec(`SELECT * FROM orders ORDER BY created_at DESC`);
      if (!res.length) return [];
      const { columns, values } = res[0];
      return values.map((row) => {
        const raw = {};
        columns.forEach((col, idx) => {
          raw[col] = row[idx];
        });
        return mapOrderRow(raw, db);
      });
    } catch (err) {
      console.error("offline:get-orders error:", err);
      return [];
    }
  });
  import_electron3.ipcMain.handle("offline:create-expense", async (_event, expenseData) => {
    try {
      const db = getDb();
      const result = createOfflineExpense(db, expenseData, (operation) => enqueueSecureOperation(db, operation));
      if (result.queued) {
        saveDatabase();
        setTimeout(() => void runSyncCycle(mainWindow2), 100);
      }
      if (result.success && mainWindow2 && !mainWindow2.isDestroyed()) {
        mainWindow2.webContents.send("sync:data-updated", { expenses: true, inventory: true });
      }
      return result;
    } catch (err) {
      console.error("offline:create-expense error:", err);
      return { success: false, message: err.message };
    }
  });
  import_electron3.ipcMain.handle("offline:get-expenses", async () => {
    try {
      const db = getDb();
      return listOfflineExpenses(db);
    } catch (err) {
      console.error("offline:get-expenses error:", err);
      return [];
    }
  });
  import_electron3.ipcMain.handle("offline:restock-inventory", async (_event, restockData) => {
    try {
      const db = getDb();
      const result = restockOfflineInventory(db, restockData, (operation) => enqueueSecureOperation(db, operation));
      if (result.queued) {
        saveDatabase();
        setTimeout(() => void runSyncCycle(mainWindow2), 100);
      }
      if (result.success && mainWindow2 && !mainWindow2.isDestroyed()) {
        mainWindow2.webContents.send("sync:data-updated", { expenses: true, inventory: true });
      }
      return result;
    } catch (err) {
      console.error("offline:restock-inventory error:", err);
      return { success: false, message: err.message };
    }
  });
  import_electron3.ipcMain.handle("offline:create-inventory-item", async (_event, itemData) => {
    try {
      const db = getDb();
      const result = createOfflineInventoryItem(db, itemData, (operation) => enqueueSecureOperation(db, operation));
      if (result.queued) {
        saveDatabase();
        setTimeout(() => void runSyncCycle(mainWindow2), 100);
      }
      if (result.success && mainWindow2 && !mainWindow2.isDestroyed()) {
        mainWindow2.webContents.send("sync:data-updated", { inventory: true, expenses: true });
      }
      return result;
    } catch (err) {
      console.error("offline:create-inventory-item error:", err);
      return { success: false, message: err.message };
    }
  });
  import_electron3.ipcMain.handle("sync:cache-entities", async (_event, { entityType, records }) => {
    try {
      if (!Array.isArray(records)) return { success: false };
      const db = getDb();
      if (entityType === "products") {
        for (const p of records) cacheServerProduct(db, p);
      } else if (entityType === "categories") {
        for (const c of records) {
          db.run(`
            INSERT OR REPLACE INTO categories (_id, name, description, updated_at)
            VALUES (?, ?, ?, ?)
          `, [c._id, c.name, c.description || "", c.updatedAt || (/* @__PURE__ */ new Date()).toISOString()]);
        }
      } else if (entityType === "inventory") {
        for (const inv of records) {
          cacheServerInventoryItem(db, inv);
        }
      } else if (entityType === "recipes") {
        for (const r of records) {
          const prodId = typeof r.product === "object" ? r.product?._id : r.product;
          db.run(`
            INSERT OR REPLACE INTO recipes (_id, product_id, ingredients, is_active, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `, [
            r._id,
            prodId,
            JSON.stringify(r.ingredients || []),
            r.isActive ? 1 : 0,
            r.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
          ]);
        }
      } else if (entityType === "orders") {
        for (const ord of records) {
          try {
            upsertSyncedOrder(db, ord);
          } catch (ordErr) {
            console.warn("Failed to cache order locally:", ord?._id, ordErr?.message);
          }
        }
      } else if (entityType === "expenses") {
        for (const exp of records) {
          try {
            cacheServerExpense(db, exp);
          } catch (expenseErr) {
            console.warn("Failed to cache server purchase locally:", exp?._id, expenseErr?.message);
          }
        }
      }
      saveDatabase();
      return { success: true };
    } catch (err) {
      console.error("sync:cache-entities error:", err);
      return { success: false, error: err.message };
    }
  });
  import_electron3.ipcMain.handle("sync:trigger", async () => {
    return runSyncCycle(mainWindow2, { forcePull: true });
  });
  import_electron3.ipcMain.handle("sync:get-queue", async () => {
    const db = getDb();
    const res = db.exec(`SELECT * FROM sync_queue ORDER BY id DESC`);
    if (!res.length) return [];
    const { columns, values } = res[0];
    return values.map((row) => {
      const obj = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  });
  import_electron3.ipcMain.handle("auth:cache-user", async (_event, { user, password, token }) => {
    try {
      if (!user || !user.email) return { success: false };
      const db = getDb();
      const hash = password ? import_crypto2.default.createHash("sha256").update(password).digest("hex") : "";
      const secureToken = token ? encryptSensitiveString(token) : "";
      db.run(`
        INSERT OR REPLACE INTO local_users (_id, user_name, email, role_type, password_hash, session_token, cached_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [user._id, user.userName, user.email.toLowerCase(), user.roleType, hash, secureToken, (/* @__PURE__ */ new Date()).toISOString()]);
      saveDatabase();
      if (token) configureSync({ token });
      return { success: true };
    } catch (err) {
      console.error("auth:cache-user error:", err);
      return { success: false, error: err.message };
    }
  });
  import_electron3.ipcMain.handle("auth:verify-offline", async (_event, { email, password }) => {
    try {
      if (!email || !password) return { success: false, message: "Missing credentials" };
      const db = getDb();
      const inputHash = import_crypto2.default.createHash("sha256").update(password).digest("hex");
      const res = db.exec(`
        SELECT _id, user_name, email, role_type, password_hash, session_token
        FROM local_users
        WHERE LOWER(email) = ?
      `, [email.toLowerCase()]);
      if (!res.length || !res[0].values.length) {
        return { success: false, message: "User not cached locally" };
      }
      const [id, userName, userEmail, roleType, storedHash, rawSessionToken] = res[0].values[0];
      if (storedHash && storedHash === inputHash) {
        const sessionToken = decryptSensitiveString(rawSessionToken);
        if (sessionToken) configureSync({ token: sessionToken });
        return {
          success: true,
          user: {
            _id: id,
            userName,
            email: userEmail,
            roleType,
            verify: true,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          },
          token: sessionToken
        };
      }
      return { success: false, message: "Invalid password" };
    } catch (err) {
      console.error("auth:verify-offline error:", err);
      return { success: false, message: err.message };
    }
  });
  import_electron3.ipcMain.handle("frontend:get-version", async () => {
    return frontendUpdater.getLocalMeta();
  });
  import_electron3.ipcMain.handle("frontend:check-update", async () => {
    return await frontendUpdater.checkForUpdates(mainWindow2);
  });
  import_electron3.ipcMain.handle("frontend:apply-update", async () => {
    return frontendUpdater.applyUpdateNow(mainWindow2);
  });
  import_electron3.ipcMain.handle("print:get-printers", async () => {
    try {
      const printers = await mainWindow2.webContents.getPrintersAsync();
      let windowsPrinterStates = /* @__PURE__ */ new Map();
      try {
        const { stdout } = await execFileAsync("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "Get-CimInstance Win32_Printer | Select-Object Name,PrinterState,WorkOffline | ConvertTo-Json -Compress"
        ], { windowsHide: true, timeout: 5e3, maxBuffer: 1024 * 1024 });
        const parsed = JSON.parse(stdout.trim() || "[]");
        const rows2 = Array.isArray(parsed) ? parsed : [parsed];
        windowsPrinterStates = new Map(rows2.map((row) => [
          String(row.Name || "").toLowerCase(),
          row.WorkOffline ? 8 : row.PrinterState !== null && row.PrinterState !== "" && Number.isFinite(Number(row.PrinterState)) ? Number(row.PrinterState) : null
        ]));
      } catch (statusErr) {
        console.warn("[print:get-printers] Windows status unavailable:", statusErr.message);
      }
      return {
        ok: true,
        printers: printers.map((p) => ({
          name: p.name,
          displayName: p.displayName || p.name,
          isDefault: p.isDefault,
          status: windowsPrinterStates.get(String(p.name).toLowerCase()) ?? null
        }))
      };
    } catch (err) {
      console.error("[print:get-printers]", err);
      return { ok: false, printers: [], error: err.message };
    }
  });
  import_electron3.ipcMain.handle("print:silent", async (_event, { html, printerName }) => {
    return new Promise((resolve) => {
      let printWin = null;
      const cleanup = () => {
        try {
          if (printWin && !printWin.isDestroyed()) printWin.close();
        } catch {
        }
        printWin = null;
      };
      try {
        printWin = new import_electron3.BrowserWindow({
          show: false,
          skipTaskbar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            javascript: true
          }
        });
        const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
        printWin.loadURL(dataUrl);
        printWin.webContents.once("did-finish-load", () => {
          setTimeout(() => {
            try {
              printWin.webContents.print(
                {
                  silent: true,
                  printBackground: true,
                  // Electron expects the system printer name as `deviceName`.
                  // `printerName` is ignored and can silently route the job to
                  // the default printer instead of the selected cashier printer.
                  deviceName: printerName || void 0,
                  margins: { marginType: "none" },
                  // Use the selected printer's configured roll/page size. Forcing
                  // A4 here clips/scales a 72mm thermal receipt into blank scraps.
                  usePrinterDefaultPageSize: true
                },
                (success, reason) => {
                  cleanup();
                  resolve({ ok: success, reason: reason || null });
                }
              );
            } catch (printErr) {
              console.error("[print:silent] print() error:", printErr);
              cleanup();
              resolve({ ok: false, reason: printErr.message });
            }
          }, 600);
        });
        setTimeout(() => {
          if (printWin) {
            console.warn("[print:silent] timeout \u2014 closing print window");
            cleanup();
            resolve({ ok: false, reason: "timeout" });
          }
        }, 15e3);
      } catch (err) {
        console.error("[print:silent] setup error:", err);
        cleanup();
        resolve({ ok: false, reason: err.message });
      }
    });
  });
}

// desktop/main/main.js
var import_meta = {};
var __dirname2 = import_electron4.app.isPackaged ? import_path4.default.join(process.resourcesPath, "app.asar", "desktop", "main") : import_path4.default.dirname((0, import_url.fileURLToPath)(import_meta.url));
if (process.env.ELECTRON_TEST_MODE === "true") {
  const testUserDataDir = process.env.ELECTRON_TEST_USER_DATA_DIR;
  if (!testUserDataDir) {
    throw new Error("Electron test mode requires ELECTRON_TEST_USER_DATA_DIR");
  }
  import_electron4.app.setPath("userData", import_path4.default.resolve(testUserDataDir));
}
function logStartup(message) {
  const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}
`;
  console.log(message);
  try {
    import_fs4.default.appendFileSync(import_path4.default.join(import_electron4.app.getPath("userData"), "startup.log"), line, "utf8");
  } catch (error) {
    console.error("[Desktop] Could not write startup log:", error);
  }
}
var mainWindow = null;
var splashWindow = null;
async function createWindow() {
  const isDev = process.env.ELECTRON_DEV === "true" || !import_electron4.app.isPackaged && process.env.NODE_ENV !== "production";
  const DEV_URL = process.env.VITE_DEV_URL || "http://localhost:3000";
  const iconPath = import_path4.default.join(__dirname2, "../icon.ico");
  if (!isDev) {
    splashWindow = new import_electron4.BrowserWindow({
      icon: iconPath,
      width: 480,
      height: 400,
      transparent: false,
      frame: false,
      alwaysOnTop: true,
      center: true,
      resizable: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    splashWindow.loadFile(import_path4.default.join(__dirname2, "../splash.html"));
  }
  mainWindow = new import_electron4.BrowserWindow({
    icon: iconPath,
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: "\u0643\u0627\u0641\u064A\u0647 \u0627\u0644\u0641\u064A\u0634\u0627\u0648\u064A - Elfishawy Cafe POS & Management",
    show: false,
    webPreferences: {
      preload: import_path4.default.join(__dirname2, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    autoHideMenuBar: !isDev
    // في dev: اظهر menu bar للـ DevTools shortcuts
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, url) => {
    logStartup(`Renderer failed to load (${errorCode}): ${errorDescription} \u2014 ${url}`);
  });
  mainWindow.webContents.on("did-finish-load", () => logStartup("Renderer finished loading."));
  mainWindow.webContents.on("dom-ready", () => logStartup("Renderer DOM is ready."));
  mainWindow.on("ready-to-show", () => logStartup("Main window is ready to show."));
  const compatibilityCssPath = import_path4.default.join(__dirname2, "../electron-compat.css");
  if (import_electron4.app.isPackaged && import_fs4.default.existsSync(compatibilityCssPath)) {
    const compatibilityCss = import_fs4.default.readFileSync(compatibilityCssPath, "utf8");
    mainWindow.webContents.on("dom-ready", () => {
      mainWindow.webContents.insertCSS(compatibilityCss).catch((error) => {
        logStartup(`Could not apply Chromium compatibility styles: ${error?.message || error}`);
      });
    });
  }
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    logStartup(`Renderer process exited: ${JSON.stringify(details)}`);
  });
  const userDataPath = import_electron4.app.getPath("userData");
  logStartup("Initializing local database\u2026");
  await initDatabase(userDataPath);
  logStartup("Local database ready.");
  setupIpcHandlers(mainWindow);
  startBackgroundSync(mainWindow);
  mainWindow.once("ready-to-show", () => {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
        if (isDev) {
          mainWindow.webContents.openDevTools({ mode: "detach" });
        }
        if (!isDev) {
          const runUpdateCheck = () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              frontendUpdater.checkForUpdates(mainWindow).catch((err) => {
                console.log("[FrontendUpdater] Periodic check finished:", err?.message || err);
              });
            }
          };
          setTimeout(runUpdateCheck, 2e3);
          setInterval(runUpdateCheck, 30 * 1e3);
        }
      }
    }, 700);
  });
  if (isDev) {
    console.log(`[Dev] Loading from Vite Dev Server: ${DEV_URL}`);
    mainWindow.loadURL(DEV_URL).catch((err) => {
      console.error(`[Dev] \u274C Failed to connect to Vite server at ${DEV_URL}`);
      console.error("[Dev] \u{1F4A1} \u062A\u0623\u0643\u062F \u0623\u0646 Vite Dev Server \u0634\u063A\u0651\u0627\u0644: npm run dev");
      console.error("[Dev] \u{1F4A1} \u0623\u0648 \u0627\u0633\u062A\u062E\u062F\u0645: npm run desktop:dev \u0644\u062A\u0634\u063A\u064A\u0644 \u0643\u0644\u064A\u0647\u0645\u0627 \u0645\u0639\u0627\u064B");
      const fallbackPath = frontendUpdater.getFrontendIndexPath();
      console.log(`[Dev] \u26A0\uFE0F Falling back to local bundle: ${fallbackPath}`);
      mainWindow.loadFile(fallbackPath);
    });
  } else {
    const frontendIndexPath = frontendUpdater.getFrontendIndexPath();
    logStartup(`Loading frontend: ${frontendIndexPath}`);
    mainWindow.loadFile(frontendIndexPath).catch((error) => {
      logStartup(`Failed to load frontend: ${error?.stack || error}`);
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
      }
    });
  }
  if (!isDev) {
    import("electron-updater").then(({ autoUpdater }) => {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.checkForUpdatesAndNotify().catch(() => {
      });
    }).catch(() => {
    });
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron4.app.whenReady().then(createWindow).catch((error) => {
  logStartup(`Startup failed: ${error?.stack || error}`);
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
  import_electron4.dialog.showErrorBox(
    "\u062A\u0639\u0630\u0631 \u062A\u0634\u063A\u064A\u0644 \u0643\u0627\u0641\u064A\u0647 \u0627\u0644\u0641\u064A\u0634\u0627\u0648\u064A",
    `\u0641\u0634\u0644 \u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u062A\u0637\u0628\u064A\u0642. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629\u060C \u0648\u0625\u0630\u0627 \u0627\u0633\u062A\u0645\u0631\u062A \u0627\u0644\u0645\u0634\u0643\u0644\u0629 \u0623\u0631\u0633\u0644 \u0647\u0630\u0647 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0644\u0644\u062F\u0639\u0645:

${error?.stack || error}`
  );
  import_electron4.app.quit();
});
import_electron4.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    import_electron4.app.quit();
  }
});
import_electron4.app.on("activate", () => {
  if (import_electron4.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
