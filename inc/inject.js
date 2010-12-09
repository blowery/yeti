function $yetify (config) {

    var w = window,
        Y = ("Y" in w) ? w.Y : false,
        Y2 = ("YAHOO" in w) ? w.YAHOO : false,
        DOH = ("doh" in w) ? w.doh : false,
        TestHarness = w.YUITest || Y2.TestRunner || DOH,
        matches;

    // No YUI? Drop and move on.
    // This file probably 404ed.
    // TODO: Stop eating this error.
    if (!Y2 && !w.YUI && !DOH) return parent && parent.YETI && parent.YETI.next();

    if (!$yetify.config) { // first run

        var path = w.location.pathname;

        if (!path) return; // very required

        if (!config) return;
        $yetify.config = config;

        matches = path.match(/^\/project\/([^\/]*)/);
        if (!matches) return;

        $yetify.config.id = matches.pop();

        // prevent careless errors
        w.print = w.confirm = w.alert = w.open = function () {};

    }

    if (Y2 && !Y2.lang.JSON) { // YUI 2.x; missing Y.lang.JSON
        var json = document.createElement("script");
        json.src = "/inc/yui2-json.js";
        document.body.appendChild(json);
        return; // yui2-json will call $yetify when ready
    }

    // poll for Y.Test or DOH
    if (!TestHarness) return w.setTimeout($yetify, 50);

    var NullYeti = {
        heartbeat: function() {}
    };

    var href = w.location.href,
        YETI = parent.YETI || NullYeti;

    YETI.heartbeat();

    function fixIE9 (v) {
        // TestReporter does UA sniffing
        // for IE 9, disable the IE hackery
        // leave other versions of IE alone
        return (v == 9) ? 0 : v;
    }
    
    function DohTestReporter(url, format) {
        // an adapter for the DOH test runner
        this.url = url;
        this.format = format;
        this._fields = {};
        this._form = null;
        this._iframe = null;
    }
    
    DohTestReporter.prototype = {
        constructor: DohTestReporter,
        
        addField: function(name, value) {
            this._fields[name] = value;
        },
        
        clearFields: function() { 
            this._fields = {};
        },
        
        destroy: function() {
            this._form && dojo.destroy(this._form);
            this._iframe && dojo.destroy(this._iframe);
            this._form = this._iframe = this._fields = null;
        },
        
        report: function(results) {
            //if the form hasn't been created yet, create it
            if (!this._form){
                this._form = document.createElement("form");
                this._form.method = "post";
                this._form.style.visibility = "hidden";
                this._form.style.position = "absolute";
                this._form.style.top = 0;
                document.body.appendChild(this._form);
            
                //IE won't let you assign a name using the DOM, must do it the hacky way
                if (dojo.isIE < 9){
                    this._iframe = document.createElement("<iframe name=\"yuiTestTarget\" />");
                } else {
                    this._iframe = document.createElement("iframe");
                    this._iframe.name = "yuiTestTarget";
                }
    
                this._iframe.src = "javascript:false";
                this._iframe.style.visibility = "hidden";
                this._iframe.style.position = "absolute";
                this._iframe.style.top = 0;
                document.body.appendChild(this._iframe);
    
                this._form.target = "yuiTestTarget";
            }
    
            //set the form's action
            this._form.action = this.url;
        
            //remove any existing fields
            while(this._form.hasChildNodes()){
                this._form.removeChild(this._form.lastChild);
            }
            
            //create default fields
            this._fields.results = this.format(results);
            this._fields.useragent = navigator.userAgent;
            this._fields.timestamp = (new Date()).toLocaleString();
    
            //add fields to the form
            for(var prop in this._fields) {
                var value = this._fields[prop];
                if (typeof value != "function"){
                    var input = document.createElement("input");
                    input.type = "hidden";
                    input.name = prop;
                    input.value = value;
                    this._form.appendChild(input);
                }
            }
    
            //remove default fields
            delete this._fields.results;
            delete this._fields.useragent;
            delete this._fields.timestamp;
            
            if (arguments[1] !== false){
                this._form.submit();
            }
        
        }
    }
    
    function DohJsonFormatter(results) {
        // assumes we have dojo available
        return dojo.toJson(results);
    }

    function attachReporter (Y) {

        var TestReporter, FormatJSON, self;

        if (Y && Y === Y2) { // yui 2.x
            TestReporter = Y.tool.TestReporter;
            FormatJSON = Y.tool.TestFormat.JSON;
            Y.env.ua.ie = fixIE9(Y.env.ua.ie);
        } else if(DOH) {
            TestReporter = DohTestReporter;
            FormatJSON = DohJsonFormatter;
        } else {
            TestReporter = Y.Test.Reporter;
            FormatJSON = Y.Test.Format.JSON;
            Y.UA.ie = fixIE9(Y.UA.ie);
        }

        function submit (data) {

            self = $yetify.config;

            if (!self.url) return;

            var reporter = new TestReporter(self.url, FormatJSON);
            reporter.addField("id", self.id);
            reporter.report(data.results);

        };

        w.onerror = function (e) {
            submit({
                results : {
                    name : href,
                    total : 1,
                    passed : 0,
                    failed : 1,
                    data : {
                        failed : 1,
                        name : "window.onerror handler (yeti virtual test)",
                        data : {
                            name : "window.onerror should not fire",
                            message : e,
                            result : "fail"
                        }
                    }
                }
            });
            return false;
        };

        if (document.compatMode !== "CSS1Compat") {
            w.onerror("Not in Standards Mode!");
        }
        
        function DohRunnerAdapter() {
            this._root = null;
            
            dojo.connect(doh, "_onEnd", this, "_dohComplete");
            dojo.connect(doh, "_testFinished", this, "_dohTestFinished");
            
            if(doh._testCount > 0) {
                // tests already ran
                this._root = {
                    results: {
                        name: href,
                        total: doh._testCount,
                        passed: doh._testCount - (doh._errorCount + doh._failureCount),
                        failed: doh._errorCount + doh._failureCount
                    }
                };
            }
        }
        
        DohRunnerAdapter.prototype = {
        
            constructor: DohRunnerAdapter,
            
            COMPLETE_EVENT: "onComplete",
            TEST_PASS_EVENT: "onTestPass",
            TEST_FAIL_EVENT: "onTestFail",
            TEST_IGNORE_EVENT: "onTestIgnore",
            
            onComplete: function() {},
            onTestPass: function() {},
            onTestFail: function() {},
            onTestIgnore: function() {},
            
            subscribe: function(eventName, fn) {
                dojo.connect(this, eventName, fn);
            },
            
            _dohComplete: function() {
                this.onComplete({
                    results: {
                        name: href,
                        total: doh._testCount,
                        passed: doh._testCount - (doh._errorCount + doh._failureCount),
                        failed: doh._errorCount + doh._failureCount
                    }
                });
            },
            
            _dohTestFinished: function(group, fixture, success) {
                if(success) this.onTestPass();
                else this.onTestFail();
            }
        };
        

        var Runner = DOH ? new DohRunnerAdapter() : (YTest.TestRunner || YTest);

        if (Runner._root && Runner._root.results && Runner._root.results.type == "report") {
            return submit(Runner._root);
        }

        Runner.subscribe(Runner.COMPLETE_EVENT, submit);
        Runner.subscribe(Runner.TEST_PASS_EVENT, YETI.heartbeat);
        Runner.subscribe(Runner.TEST_FAIL_EVENT, YETI.heartbeat);
        Runner.subscribe(Runner.TEST_IGNORE_EVENT, YETI.heartbeat);

    }

    if (DOH) attachReporter()
    else if (Y2) attachReporter(Y2)
    else w.YUI().use("test", attachReporter);

};
