(function() {
    var domStatus = document.getElementById("status");
    var domSectNav = document.getElementById("sectNav");
    var domListNav = document.getElementById("listNav");
    var domSectPkgs = document.getElementById("sectPkgs");
    var domListPkgs = document.getElementById("listPkgs");
    var domSectTypes = document.getElementById("sectTypes");
    var domListTypes = document.getElementById("listTypes");
    var domSectNamespaces = document.getElementById("sectNamespaces");
    var domListNamespaces = document.getElementById("listNamespaces");
    var domSectErrSets = document.getElementById("sectErrSets");
    var domListErrSets = document.getElementById("listErrSets");
    var domSectFns = document.getElementById("sectFns");
    var domListFns = document.getElementById("listFns");
    var domSectFields = document.getElementById("sectFields");
    var domListFields = document.getElementById("listFields");
    var domSectGlobalVars = document.getElementById("sectGlobalVars");
    var domListGlobalVars = document.getElementById("listGlobalVars");
    var domSectValues = document.getElementById("sectValues");
    var domListValues = document.getElementById("listValues");
    var domFnProto = document.getElementById("fnProto");
    var domFnProtoCode = document.getElementById("fnProtoCode");
    var domFnDocs = document.getElementById("fnDocs");
    var domSectFnErrors = document.getElementById("sectFnErrors");
    var domListFnErrors = document.getElementById("listFnErrors");
    var domTableFnErrors = document.getElementById("tableFnErrors");
    var domFnErrorsAnyError = document.getElementById("fnErrorsAnyError");
    var domFnExamples = document.getElementById("fnExamples");
    var domFnNoExamples = document.getElementById("fnNoExamples");
    var domDeclNoRef = document.getElementById("declNoRef");
    var domSearch = document.getElementById("search");
    var domSectSearchResults = document.getElementById("sectSearchResults");
    var domListSearchResults = document.getElementById("listSearchResults");
    var domSectSearchNoResults = document.getElementById("sectSearchNoResults");
    var domSectInfo = document.getElementById("sectInfo");
    var domListInfo = document.getElementById("listInfo");
    var domTdTarget = document.getElementById("tdTarget");
    var domTdZigVer = document.getElementById("tdZigVer");
    var domHdrName = document.getElementById("hdrName");
    var domHelpModal = document.getElementById("helpDialog");

    var searchTimer = null;
    var escapeHtmlReplacements = { "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" };

    var typeKinds = indexTypeKinds();
    var typeTypeId = findTypeTypeId();
    var pointerSizeEnum = { One: 0, Many: 1, Slice: 2, C: 3 };

    // for each package, is an array with packages to get to this one
    var canonPkgPaths = computeCanonicalPackagePaths();
    // for each decl, is an array with {declNames, pkgNames} to get to this one
    var canonDeclPaths = null; // lazy; use getCanonDeclPath
    // for each type, is an array with {declNames, pkgNames} to get to this one
    var canonTypeDecls = null; // lazy; use getCanonTypeDecl

    var curNav = {
        // each element is a package name, e.g. @import("a") then within there @import("b")
        // starting implicitly from root package
        pkgNames: [],
        // same as above except actual packages, not names
        pkgObjs: [],
        // Each element is a decl name, `a.b.c`, a is 0, b is 1, c is 2, etc.
        // empty array means refers to the package itself
        declNames: [],
        // these will be all types, except the last one may be a type or a decl
        declObjs: [],
    };
    var curNavSearch = "";
    var curSearchIndex = -1;
    var imFeelingLucky = false;

    var rootIsStd = detectRootIsStd();

    // map of decl index to list of non-generic fn indexes
    var nodesToFnsMap = indexNodesToFns();
    // map of decl index to list of comptime fn calls
    var nodesToCallsMap = indexNodesToCalls();

    domSearch.addEventListener('keydown', onSearchKeyDown, false);
    window.addEventListener('hashchange', onHashChange, false);
    window.addEventListener('keydown', onWindowKeyDown, false);
    onHashChange();

    function renderTitle() {
        var list = curNav.pkgNames.concat(curNav.declNames);
        var suffix = " - Zig";
        if (list.length === 0) {
            if (rootIsStd) {
                document.title = "std" + suffix;
            } else {
                document.title = zigAnalysis.params.rootName + suffix;
            }
        } else {
            document.title = list.join('.') + suffix;
        }
    }

    function render() {
        domStatus.classList.add("hidden");
        domFnProto.classList.add("hidden");
        domFnDocs.classList.add("hidden");
        domSectPkgs.classList.add("hidden");
        domSectTypes.classList.add("hidden");
        domSectNamespaces.classList.add("hidden");
        domSectErrSets.classList.add("hidden");
        domSectFns.classList.add("hidden");
        domSectFields.classList.add("hidden");
        domSectSearchResults.classList.add("hidden");
        domSectSearchNoResults.classList.add("hidden");
        domSectInfo.classList.add("hidden");
        domHdrName.classList.add("hidden");
        domSectNav.classList.add("hidden");
        domSectFnErrors.classList.add("hidden");
        domFnExamples.classList.add("hidden");
        domFnNoExamples.classList.add("hidden");
        domDeclNoRef.classList.add("hidden");
        domFnErrorsAnyError.classList.add("hidden");
        domTableFnErrors.classList.add("hidden");
        domSectGlobalVars.classList.add("hidden");
        domSectValues.classList.add("hidden");

        renderTitle();
        renderInfo();
        renderPkgList();

        if (curNavSearch !== "") {
            return renderSearch();
        }

        var rootPkg = zigAnalysis.packages[zigAnalysis.rootPkg];
        var pkg = rootPkg;
        curNav.pkgObjs = [pkg];
        for (var i = 0; i < curNav.pkgNames.length; i += 1) {
            var childPkg = zigAnalysis.packages[pkg.table[curNav.pkgNames[i]]];
            if (childPkg == null) {
                return render404();
            }
            pkg = childPkg;
            curNav.pkgObjs.push(pkg);
        }

        var decl = zigAnalysis.types[pkg.main];
        curNav.declObjs = [decl];
        for (var i = 0; i < curNav.declNames.length; i += 1) {
            var childDecl = findSubDecl(decl, curNav.declNames[i]);
            if (childDecl == null) {
                return render404();
            }
            var container = getDeclContainerType(childDecl);
            if (container == null) {
                if (i + 1 === curNav.declNames.length) {
                    curNav.declObjs.push(childDecl);
                    break;
                } else {
                    return render404();
                }
            }
            decl = container;
            curNav.declObjs.push(decl);
        }

        renderNav();

        var lastDecl = curNav.declObjs[curNav.declObjs.length - 1];
        if (lastDecl.pubDecls != null) {
            renderContainer(lastDecl);
        }
        if (lastDecl.kind == null) {
            return renderUnknownDecl(lastDecl);
        } else if (lastDecl.kind === 'var') {
            return renderVar(lastDecl);
        } else if (lastDecl.kind === 'const' && lastDecl.type != null) {
            var typeObj = zigAnalysis.types[lastDecl.type];
            if (typeObj.kind === typeKinds.Fn) {
                return renderFn(lastDecl);
            } else {
                return renderValue(lastDecl);
            }
        } else {
            renderType(lastDecl);
        }
    }

    function renderUnknownDecl(decl) {
        domDeclNoRef.classList.remove("hidden");

        var docs = zigAnalysis.astNodes[decl.src].docs;
        if (docs != null) {
            domFnDocs.innerHTML = markdown(docs);
        } else {
            domFnDocs.innerHTML = '<p>There are no doc comments for this declaration.</p>';
        }
        domFnDocs.classList.remove("hidden");
    }

    function typeIsErrSet(typeIndex) {
        var typeObj = zigAnalysis.types[typeIndex];
        return typeObj.kind === typeKinds.ErrorSet;
    }

    function typeIsStructWithNoFields(typeIndex) {
        var typeObj = zigAnalysis.types[typeIndex];
        if (typeObj.kind !== typeKinds.Struct)
            return false;
        return typeObj.fields == null || typeObj.fields.length === 0;
    }

    function typeIsGenericFn(typeIndex) {
        var typeObj = zigAnalysis.types[typeIndex];
        if (typeObj.kind !== typeKinds.Fn) {
            return false;
        }
        return typeObj.generic;
    }

    function renderFn(fnDecl) {
        domFnProtoCode.innerHTML = typeIndexName(fnDecl.type, true, true, fnDecl);

        var docsSource = null;
        var srcNode = zigAnalysis.astNodes[fnDecl.src];
        if (srcNode.docs != null) {
            docsSource = srcNode.docs;
        }

        var typeObj = zigAnalysis.types[fnDecl.type];
        var errSetTypeIndex = null;
        if (typeObj.ret != null) {
            var retType = zigAnalysis.types[typeObj.ret];
            if (retType.kind === typeKinds.ErrorSet) {
                errSetTypeIndex = typeObj.ret;
            } else if (retType.kind === typeKinds.ErrorUnion) {
                errSetTypeIndex = retType.err;
            }
        }
        if (errSetTypeIndex != null) {
            var errSetType = zigAnalysis.types[errSetTypeIndex];
            renderErrorSet(errSetType);
        }

        var protoSrcIndex;
        if (typeIsGenericFn(fnDecl.type)) {
            protoSrcIndex = fnDecl.value;

            var instantiations = nodesToFnsMap[protoSrcIndex];
            var calls = nodesToCallsMap[protoSrcIndex];
            if (instantiations == null && calls == null) {
                domFnNoExamples.classList.remove("hidden");
            } else {
                // TODO show examples
                domFnExamples.classList.remove("hidden");
            }
        } else {
            protoSrcIndex = zigAnalysis.fns[fnDecl.value].src;

            domFnExamples.classList.add("hidden");
            domFnNoExamples.classList.add("hidden");
        }

        var protoSrcNode = zigAnalysis.astNodes[protoSrcIndex];
        if (docsSource == null && protoSrcNode != null && protoSrcNode.docs != null) {
            docsSource = protoSrcNode.docs;
        }
        if (docsSource != null) {
            domFnDocs.innerHTML = markdown(docsSource);
            domFnDocs.classList.remove("hidden");
        }
        domFnProto.classList.remove("hidden");
    }

    function renderNav() {
        var len = curNav.pkgNames.length + curNav.declNames.length;
        resizeDomList(domListNav, len, '<li><a href="#"></a></li>');
        var list = [];
        var hrefPkgNames = [];
        var hrefDeclNames = [];
        for (var i = 0; i < curNav.pkgNames.length; i += 1) {
            hrefPkgNames.push(curNav.pkgNames[i]);
            list.push({
                name: curNav.pkgNames[i],
                link: navLink(hrefPkgNames, hrefDeclNames),
            });
        }
        for (var i = 0; i < curNav.declNames.length; i += 1) {
            hrefDeclNames.push(curNav.declNames[i]);
            list.push({
                name: curNav.declNames[i],
                link: navLink(hrefPkgNames, hrefDeclNames),
            });
        }

        for (var i = 0; i < list.length; i += 1) {
            var liDom = domListNav.children[i];
            var aDom = liDom.children[0];
            aDom.textContent = list[i].name;
            aDom.setAttribute('href', list[i].link);
            if (i + 1 == list.length) {
                aDom.classList.add("active");
            } else {
                aDom.classList.remove("active");
            }
        }

        domSectNav.classList.remove("hidden");
    }

    function renderInfo() {
        domTdZigVer.textContent = zigAnalysis.params.zigVersion;
        domTdTarget.textContent = zigAnalysis.params.builds[0].target;

        domSectInfo.classList.remove("hidden");
    }

    function render404() {
        domStatus.textContent = "404 Not Found";
        domStatus.classList.remove("hidden");
    }

    function renderPkgList() {
        var rootPkg = zigAnalysis.packages[zigAnalysis.rootPkg];
        var list = [];
        for (var key in rootPkg.table) {
            if (key === "root" && rootIsStd) continue;
            var pkgIndex = rootPkg.table[key];
            if (zigAnalysis.packages[pkgIndex] == null) continue;
            list.push({
                name: key,
                pkg: pkgIndex,
            });
        }
        list.sort(function(a, b) {
            return operatorCompare(a.name.toLowerCase(), b.name.toLowerCase());
        });

        if (list.length !== 0) {
            resizeDomList(domListPkgs, list.length, '<li><a href="#"></a></li>');
            for (var i = 0; i < list.length; i += 1) {
                var liDom = domListPkgs.children[i];
                var aDom = liDom.children[0];
                aDom.textContent = list[i].name;
                aDom.setAttribute('href', navLinkPkg(list[i].pkg));
                if (list[i].name === curNav.pkgNames[0]) {
                    aDom.classList.add("active");
                } else {
                    aDom.classList.remove("active");
                }
            }

            domSectPkgs.classList.remove("hidden");
        }
    }

    function navLink(pkgNames, declNames) {
        if (pkgNames.length === 0 && declNames.length === 0) {
            return '#';
        } else if (declNames.length === 0) {
            return '#' + pkgNames.join('.');
        } else {
            return '#' + pkgNames.join('.') + ';' + declNames.join('.');
        }
    }

    function navLinkPkg(pkgIndex) {
        return navLink(canonPkgPaths[pkgIndex], []);
    }

    function navLinkDecl(childName) {
        return navLink(curNav.pkgNames, curNav.declNames.concat([childName]));
    }

    function resizeDomListDl(dlDom, desiredLen) {
        // add the missing dom entries
        var i, ev;
        for (i = dlDom.childElementCount / 2; i < desiredLen; i += 1) {
            dlDom.insertAdjacentHTML('beforeend', '<dt></dt><dd></dd>');
        }
        // remove extra dom entries
        while (desiredLen < dlDom.childElementCount / 2) {
            dlDom.removeChild(dlDom.lastChild);
            dlDom.removeChild(dlDom.lastChild);
        }
    }

    function resizeDomList(listDom, desiredLen, templateHtml) {
        // add the missing dom entries
        var i, ev;
        for (i = listDom.childElementCount; i < desiredLen; i += 1) {
            listDom.insertAdjacentHTML('beforeend', templateHtml);
        }
        // remove extra dom entries
        while (desiredLen < listDom.childElementCount) {
            listDom.removeChild(listDom.lastChild);
        }
    }

    function typeIndexName(typeIndex, wantHtml, wantLink, fnDecl, linkFnNameDecl) {
        var typeObj = zigAnalysis.types[typeIndex];
        var declNameOk = declCanRepresentTypeKind(typeObj.kind);
        if (wantLink) {
            var declIndex = getCanonTypeDecl(typeIndex);
            var declPath = getCanonDeclPath(declIndex);
            if (declPath == null) {
                return typeName(typeObj, wantHtml, wantLink, fnDecl, linkFnNameDecl);
            }
            var name = (wantLink && declCanRepresentTypeKind(typeObj.kind)) ?
                declPath.declNames[declPath.declNames.length - 1] :
                typeName(typeObj, wantHtml, false, fnDecl, linkFnNameDecl);
            if (wantLink && wantHtml) {
                return '<a href="' + navLink(declPath.pkgNames, declPath.declNames) + '">' + name + '</a>';
            } else {
                return name;
            }
        } else {
            return typeName(typeObj, wantHtml, false, fnDecl, linkFnNameDecl);
        }
    }

    function shouldSkipParamName(typeIndex, paramName) {
        var typeObj = zigAnalysis.types[typeIndex];
        if (typeObj.kind === typeKinds.Pointer && getPtrSize(typeObj) === pointerSizeEnum.One) {
            typeIndex = typeObj.elem;
        }
        return typeIndexName(typeIndex, false, true).toLowerCase() === paramName;
    }

    function getPtrSize(typeObj) {
        return (typeObj.len == null) ? pointerSizeEnum.One : typeObj.len;
    }

    function typeName(typeObj, wantHtml, wantSubLink, fnDecl, linkFnNameDecl) {
        switch (typeObj.kind) {
            case typeKinds.Array:
                var name = "[";
                if (wantHtml) {
                    name += '<span class="tok-number">' + typeObj.len + '</span>';
                } else {
                    name += typeObj.len;
                }
                name += "]";
                name += typeIndexName(typeObj.elem, wantHtml, wantSubLink, null);
                return name;
            case typeKinds.Optional:
                return "?" + typeIndexName(typeObj.child, wantHtml, wantSubLink, fnDecl, linkFnNameDecl);
            case typeKinds.Pointer:
                var name = "";
                switch (typeObj.len) {
                    case pointerSizeEnum.One:
                    default:
                        name += "*";
                        break;
                    case pointerSizeEnum.Many:
                        name += "[*]";
                        break;
                    case pointerSizeEnum.Slice:
                        name += "[]";
                        break;
                    case pointerSizeEnum.C:
                        name += "[*c]";
                        break;
                }
                if (typeObj['const']) {
                    if (wantHtml) {
                        name += '<span class="tok-kw">const</span> ';
                    } else {
                        name += "const ";
                    }
                }
                if (typeObj['volatile']) {
                    if (wantHtml) {
                        name += '<span class="tok-kw">volatile</span> ';
                    } else {
                        name += "volatile ";
                    }
                }
                if (typeObj.align != null) {
                    if (wantHtml) {
                        name += '<span class="tok-kw">align</span>(';
                    } else {
                        name += "align(";
                    }
                    if (wantHtml) {
                        name += '<span class="tok-number">' + typeObj.align + '</span>';
                    } else {
                        name += typeObj.align;
                    }
                    if (typeObj.hostIntBytes != null) {
                        name += ":";
                        if (wantHtml) {
                            name += '<span class="tok-number">' + typeObj.bitOffsetInHost + '</span>';
                        } else {
                            name += typeObj.bitOffsetInHost;
                        }
                        name += ":";
                        if (wantHtml) {
                            name += '<span class="tok-number">' + typeObj.hostIntBytes + '</span>';
                        } else {
                            name += typeObj.hostIntBytes;
                        }
                    }
                    name += ") ";
                }
                name += typeIndexName(typeObj.elem, wantHtml, wantSubLink, null);
                return name;
            case typeKinds.Float:
                if (wantHtml) {
                    return '<span class="tok-type">f' + typeObj.bits + '</span>';
                } else {
                    return "f" + typeObj.bits;
                }
            case typeKinds.Int:
                var signed = (typeObj.i != null) ? 'i' : 'u';
                var bits = typeObj[signed];
                if (wantHtml) {
                    return '<span class="tok-type">' + signed + bits + '</span>';
                } else {
                    return signed + bits;
                }
            case typeKinds.ComptimeInt:
                if (wantHtml) {
                    return '<span class="tok-type">comptime_int</span>';
                } else {
                    return "comptime_int";
                }
            case typeKinds.ComptimeFloat:
                if (wantHtml) {
                    return '<span class="tok-type">comptime_float</span>';
                } else {
                    return "comptime_float";
                }
            case typeKinds.Type:
                if (wantHtml) {
                    return '<span class="tok-type">type</span>';
                } else {
                    return "type";
                }
            case typeKinds.Bool:
                if (wantHtml) {
                    return '<span class="tok-type">bool</span>';
                } else {
                    return "bool";
                }
            case typeKinds.Void:
                if (wantHtml) {
                    return '<span class="tok-type">void</span>';
                } else {
                    return "void";
                }
            case typeKinds.NoReturn:
                if (wantHtml) {
                    return '<span class="tok-type">noreturn</span>';
                } else {
                    return "noreturn";
                }
            case typeKinds.ErrorSet:
                if (typeObj.errors == null) {
                    if (wantHtml) {
                        return '<span class="tok-type">anyerror</span>';
                    } else {
                        return "anyerror";
                    }
                } else {
                    if (wantHtml) {
                        return escapeHtml(typeObj.name);
                    } else {
                        return typeObj.name;
                    }
                }
            case typeKinds.ErrorUnion:
                var errSetTypeObj = zigAnalysis.types[typeObj.err];
                var payloadHtml = typeIndexName(typeObj.payload, wantHtml, wantSubLink, null);
                if (fnDecl != null && errSetTypeObj.fn === fnDecl.value) {
                    // function index parameter supplied and this is the inferred error set of it
                    return "!" + payloadHtml;
                } else {
                    return typeIndexName(typeObj.err, wantHtml, wantSubLink, null) + "!" + payloadHtml;
                }
            case typeKinds.Fn:
                var payloadHtml = "";
                if (wantHtml) {
                    payloadHtml += '<span class="tok-kw">fn</span>';
                    if (fnDecl != null) {
                        payloadHtml += ' <span class="tok-fn">';
                        if (linkFnNameDecl != null) {
                            payloadHtml += '<a href="' + linkFnNameDecl + '">' +
                                escapeHtml(fnDecl.name) + '</a>';
                        } else {
                            payloadHtml += escapeHtml(fnDecl.name);
                        }
                        payloadHtml += '</span>';
                    }
                } else {
                    payloadHtml += 'fn'
                }
                payloadHtml += '(';
                if (typeObj.args != null) {
                    for (var i = 0; i < typeObj.args.length; i += 1) {
                        if (i != 0) {
                            payloadHtml += ', ';
                        }

                        var argTypeIndex = typeObj.args[i];

                        if (fnDecl != null && zigAnalysis.astNodes[fnDecl.src].fields != null) {
                            var paramDeclIndex = zigAnalysis.astNodes[fnDecl.src].fields[i];
                            var paramName = zigAnalysis.astNodes[paramDeclIndex].name;

                            if (paramName != null) {
                                // skip if it matches the type name
                                if (argTypeIndex == null || !shouldSkipParamName(argTypeIndex, paramName)) {
                                    payloadHtml += paramName + ': ';
                                }
                            }
                        }

                        if (argTypeIndex != null) {
                            payloadHtml += typeIndexName(argTypeIndex, wantHtml, wantSubLink);
                        } else if (wantHtml) {
                            payloadHtml += '<span class="tok-kw">var</span>';
                        } else {
                            payloadHtml += 'var';
                        }
                    }
                }

                payloadHtml += ') ';
                if (typeObj.ret != null) {
                    payloadHtml += typeIndexName(typeObj.ret, wantHtml, wantSubLink, fnDecl);
                } else if (wantHtml) {
                    payloadHtml += '<span class="tok-kw">var</span>';
                } else {
                    payloadHtml += 'var';
                }
                return payloadHtml;
            default:
                if (wantHtml) {
                    return escapeHtml(typeObj.name);
                } else {
                    return typeObj.name;
                }
        }
    }

    function renderType(typeObj) {
        var name;
        if (rootIsStd && typeObj === zigAnalysis.types[zigAnalysis.packages[zigAnalysis.rootPkg].main]) {
            name = "std";
        } else {
            name = typeName(typeObj, false, false);
        }
        if (name != null && name != "") {
            domHdrName.innerText = name + " (" + zigAnalysis.typeKinds[typeObj.kind] + ")";
            domHdrName.classList.remove("hidden");
        }
        if (typeObj.kind == typeKinds.ErrorSet) {
            renderErrorSet(typeObj);
        }
    }

    function renderErrorSet(errSetType) {
        if (errSetType.errors == null) {
            domFnErrorsAnyError.classList.remove("hidden");
        } else {
            var errorList = [];
            for (var i = 0; i < errSetType.errors.length; i += 1) {
                var errObj = zigAnalysis.errors[errSetType.errors[i]];
                var srcObj = zigAnalysis.astNodes[errObj.src];
                errorList.push({
                    err: errObj,
                    docs: srcObj.docs,
                });
            }
            errorList.sort(function(a, b) {
                return operatorCompare(a.err.name.toLowerCase(), b.err.name.toLowerCase());
            });

            resizeDomListDl(domListFnErrors, errorList.length);
            for (var i = 0; i < errorList.length; i += 1) {
                var nameTdDom = domListFnErrors.children[i * 2 + 0];
                var descTdDom = domListFnErrors.children[i * 2 + 1];
                nameTdDom.textContent = errorList[i].err.name;
                var docs = errorList[i].docs;
                if (docs != null) {
                    descTdDom.innerHTML = markdown(docs);
                } else {
                    descTdDom.textContent = "";
                }
            }
            domTableFnErrors.classList.remove("hidden");
        }
        domSectFnErrors.classList.remove("hidden");
    }

    function allCompTimeFnCallsHaveTypeResult(typeIndex, value) {
        var srcIndex = typeIsGenericFn(typeIndex) ? value : zigAnalysis.fns[value].src;
        var calls = nodesToCallsMap[srcIndex];
        if (calls == null) return false;
        for (var i = 0; i < calls.length; i += 1) {
            var call = zigAnalysis.calls[calls[i]];
            if (call.result.type !== typeTypeId) return false;
        }
        return true;
    }

    function renderValue(decl) {
        domFnProtoCode.innerHTML = '<span class="tok-kw">const</span> ' +
            escapeHtml(decl.name) + ': ' + typeIndexName(decl.type, true, true);

        var docs = zigAnalysis.astNodes[decl.src].docs;
        if (docs != null) {
            domFnDocs.innerHTML = markdown(docs);
            domFnDocs.classList.remove("hidden");
        }

        domFnProto.classList.remove("hidden");
    }

    function renderVar(decl) {
        domFnProtoCode.innerHTML = '<span class="tok-kw">var</span> ' +
            escapeHtml(decl.name) + ': ' + typeIndexName(decl.type, true, true);

        var docs = zigAnalysis.astNodes[decl.src].docs;
        if (docs != null) {
            domFnDocs.innerHTML = markdown(docs);
            domFnDocs.classList.remove("hidden");
        }

        domFnProto.classList.remove("hidden");
    }

    function renderContainer(container) {
        var typesList = [];
        var namespacesList = [];
        var errSetsList = [];
        var fnsList = [];
        var varsList = [];
        var valsList = [];
        for (var i = 0; i < container.pubDecls.length; i += 1) {
            var decl = zigAnalysis.decls[container.pubDecls[i]];
            if (decl.kind === 'var') {
                varsList.push(decl);
                continue;
            } else if (decl.kind === 'const' && decl.type != null) {
                if (decl.type == typeTypeId) {
                    if (typeIsErrSet(decl.value)) {
                        errSetsList.push(decl);
                    } else if (typeIsStructWithNoFields(decl.value)) {
                        namespacesList.push(decl);
                    } else {
                        typesList.push(decl);
                    }
                } else {
                    var typeKind = zigAnalysis.types[decl.type].kind;
                    if (typeKind === typeKinds.Fn) {
                        if (allCompTimeFnCallsHaveTypeResult(decl.type, decl.value)) {
                            typesList.push(decl);
                        } else {
                            fnsList.push(decl);
                        }
                    } else {
                        valsList.push(decl);
                    }
                }
            }
        }
        typesList.sort(byNameProperty);
        namespacesList.sort(byNameProperty);
        errSetsList.sort(byNameProperty);
        fnsList.sort(byNameProperty);
        varsList.sort(byNameProperty);
        valsList.sort(byNameProperty);

        if (typesList.length !== 0) {
            resizeDomList(domListTypes, typesList.length, '<li><a href="#"></a></li>');
            for (var i = 0; i < typesList.length; i += 1) {
                var liDom = domListTypes.children[i];
                var aDom = liDom.children[0];
                var decl = typesList[i];
                aDom.textContent = decl.name;
                aDom.setAttribute('href', navLinkDecl(decl.name));
            }
            domSectTypes.classList.remove("hidden");
        }
        if (namespacesList.length !== 0) {
            resizeDomList(domListNamespaces, namespacesList.length, '<li><a href="#"></a></li>');
            for (var i = 0; i < namespacesList.length; i += 1) {
                var liDom = domListNamespaces.children[i];
                var aDom = liDom.children[0];
                var decl = namespacesList[i];
                aDom.textContent = decl.name;
                aDom.setAttribute('href', navLinkDecl(decl.name));
            }
            domSectNamespaces.classList.remove("hidden");
        }

        if (errSetsList.length !== 0) {
            resizeDomList(domListErrSets, errSetsList.length, '<li><a href="#"></a></li>');
            for (var i = 0; i < errSetsList.length; i += 1) {
                var liDom = domListErrSets.children[i];
                var aDom = liDom.children[0];
                var decl = errSetsList[i];
                aDom.textContent = decl.name;
                aDom.setAttribute('href', navLinkDecl(decl.name));
            }
            domSectErrSets.classList.remove("hidden");
        }

        if (fnsList.length !== 0) {
            resizeDomList(domListFns, fnsList.length, '<tr><td></td><td></td></tr>');
            for (var i = 0; i < fnsList.length; i += 1) {
                var decl = fnsList[i];
                var trDom = domListFns.children[i];

                var tdFnCode = trDom.children[0];
                var tdDesc = trDom.children[1];

                tdFnCode.innerHTML = typeIndexName(decl.type, true, true, decl, navLinkDecl(decl.name));

                var docs = zigAnalysis.astNodes[decl.src].docs;
                if (docs != null) {
                    tdDesc.innerHTML = shortDescMarkdown(docs);
                } else {
                    tdDesc.textContent = "";
                }
            }
            domSectFns.classList.remove("hidden");
        }

        if (container.fields != null && container.fields.length !== 0) {
            resizeDomList(domListFields, container.fields.length, '<div></div>');

            var containerNode = zigAnalysis.astNodes[container.src];
            for (var i = 0; i < container.fields.length; i += 1) {
                var field = container.fields[i];
                var fieldNode = zigAnalysis.astNodes[containerNode.fields[i]];
                var divDom = domListFields.children[i];

                var html = '<pre>' + escapeHtml(fieldNode.name);

                if (container.kind === typeKinds.Enum) {
                    html += ' = <span class="tok-number">' + field + '</span>';
                } else {
                    html += ": " + typeIndexName(field, true, true);
                }

                html += ',</pre>';

                var docs = fieldNode.docs;
                if (docs != null) {
                    html += markdown(docs);
                }
                divDom.innerHTML = html;
            }
            domSectFields.classList.remove("hidden");
        }

        if (varsList.length !== 0) {
            resizeDomList(domListGlobalVars, varsList.length,
                '<tr><td><a href="#"></a></td><td></td><td></td></tr>');
            for (var i = 0; i < varsList.length; i += 1) {
                var decl = varsList[i];
                var trDom = domListGlobalVars.children[i];

                var tdName = trDom.children[0];
                var tdNameA = tdName.children[0];
                var tdType = trDom.children[1];
                var tdDesc = trDom.children[2];

                tdNameA.setAttribute('href', navLinkDecl(decl.name));
                tdNameA.textContent = decl.name;

                tdType.innerHTML = typeIndexName(decl.type, true, true);

                var docs = zigAnalysis.astNodes[decl.src].docs;
                if (docs != null) {
                    tdDesc.innerHTML = shortDescMarkdown(docs);
                } else {
                    tdDesc.textContent = "";
                }
            }
            domSectGlobalVars.classList.remove("hidden");
        }

        if (valsList.length !== 0) {
            resizeDomList(domListValues, valsList.length,
                '<tr><td><a href="#"></a></td><td></td><td></td></tr>');
            for (var i = 0; i < valsList.length; i += 1) {
                var decl = valsList[i];
                var trDom = domListValues.children[i];

                var tdName = trDom.children[0];
                var tdNameA = tdName.children[0];
                var tdType = trDom.children[1];
                var tdDesc = trDom.children[2];

                tdNameA.setAttribute('href', navLinkDecl(decl.name));
                tdNameA.textContent = decl.name;

                tdType.innerHTML = typeIndexName(decl.type, true, true);

                var docs = zigAnalysis.astNodes[decl.src].docs;
                if (docs != null) {
                    tdDesc.innerHTML = shortDescMarkdown(docs);
                } else {
                    tdDesc.textContent = "";
                }
            }
            domSectValues.classList.remove("hidden");
        }
    }

    function operatorCompare(a, b) {
        if (a === b) {
            return 0;
        } else if (a < b) {
            return -1;
        } else {
            return 1;
        }
    }

    function detectRootIsStd() {
        var rootPkg = zigAnalysis.packages[zigAnalysis.rootPkg];
        if (rootPkg.table["std"] == null) {
            // no std mapped into the root package
            return false;
        }
        var stdPkg = zigAnalysis.packages[rootPkg.table["std"]];
        if (stdPkg == null) return false;
        return rootPkg.file === stdPkg.file;
    }

    function indexTypeKinds() {
        var map = {};
        for (var i = 0; i < zigAnalysis.typeKinds.length; i += 1) {
            map[zigAnalysis.typeKinds[i]] = i;
        }
        // This is just for debugging purposes, not needed to function
        var assertList = ["Type","Void","Bool","NoReturn","Int","Float","Pointer","Array","Struct",
            "ComptimeFloat","ComptimeInt","Undefined","Null","Optional","ErrorUnion","ErrorSet","Enum",
            "Union","Fn","BoundFn","ArgTuple","Opaque","Frame","AnyFrame","Vector","EnumLiteral"];
        for (var i = 0; i < assertList.length; i += 1) {
            if (map[assertList[i]] == null) throw new Error("No type kind '" + assertList[i] + "' found");
        }
        return map;
    }

    function findTypeTypeId() {
        for (var i = 0; i < zigAnalysis.types.length; i += 1) {
            if (zigAnalysis.types[i].kind == typeKinds.Type) {
                return i;
            }
        }
        throw new Error("No type 'type' found");
    }

    function updateCurNav() {
        curNav = {
            pkgNames: [],
            pkgObjs: [],
            declNames: [],
            declObjs: [],
        };
        curNavSearch = "";

        if (location.hash[0] === '#' && location.hash.length > 1) {
            var query = location.hash.substring(1);
            var qpos = query.indexOf("?");
            if (qpos === -1) {
                nonSearchPart = query;
            } else {
                nonSearchPart = query.substring(0, qpos);
                curNavSearch = decodeURIComponent(query.substring(qpos + 1));
            }

            var parts = nonSearchPart.split(";");
            curNav.pkgNames = decodeURIComponent(parts[0]).split(".");
            if (parts[1] != null) {
                curNav.declNames = decodeURIComponent(parts[1]).split(".");
            }
        }

        if (curNav.pkgNames.length === 0 && rootIsStd) {
            curNav.pkgNames = ["std"];
        }
    }

    function onHashChange() {
        updateCurNav();
        if (domSearch.value !== curNavSearch) {
            domSearch.value = curNavSearch;
        }
        render();
        if (imFeelingLucky) {
            imFeelingLucky = false;
            activateSelectedResult();
        }
    }

    function findSubDecl(parentType, childName) {
        if (parentType.pubDecls == null) throw new Error("parent object has no public decls");
        for (var i = 0; i < parentType.pubDecls.length; i += 1) {
            var declIndex = parentType.pubDecls[i];
            var childDecl = zigAnalysis.decls[declIndex];
            if (childDecl.name === childName) {
                return childDecl;
            }
        }
        return null;
    }

    function getDeclContainerType(decl) {
        if (decl.type === typeTypeId) {
            return zigAnalysis.types[decl.value];
        }
        return null;
    }

    function computeCanonicalPackagePaths() {
        var list = new Array(zigAnalysis.packages.length);
        // Now we try to find all the packages from root.
        var rootPkg = zigAnalysis.packages[zigAnalysis.rootPkg];
        // Breadth-first to keep the path shortest possible.
        var stack = [{
            path: [],
            pkg: rootPkg,
        }];
        while (stack.length !== 0) {
            var item = stack.shift();
            for (var key in item.pkg.table) {
                var childPkgIndex = item.pkg.table[key];
                if (list[childPkgIndex] != null) continue;
                var childPkg = zigAnalysis.packages[childPkgIndex];
                if (childPkg == null) continue;

                var newPath = item.path.concat([key])
                list[childPkgIndex] = newPath;
                stack.push({
                    path: newPath,
                    pkg: childPkg,
                });
            }
        }
        return list;
    }

    function declCanRepresentTypeKind(typeKind) {
        return typeKind === typeKinds.ErrorSet ||
            typeKind === typeKinds.Struct ||
            typeKind === typeKinds.Union ||
            typeKind === typeKinds.Enum;
    }

    function computeCanonDeclPaths() {
        var list = new Array(zigAnalysis.decls.length);
        canonTypeDecls = new Array(zigAnalysis.types.length);

        for (var pkgI = 0; pkgI < zigAnalysis.packages.length; pkgI += 1) {
            if (pkgI === zigAnalysis.rootPkg && rootIsStd) continue;
            var pkg = zigAnalysis.packages[pkgI];
            var pkgNames = canonPkgPaths[pkgI];
            var stack = [{
                declNames: [],
                type: zigAnalysis.types[pkg.main],
            }];
            while (stack.length !== 0) {
                var item = stack.shift();

                if (item.type.pubDecls != null) {
                    for (var declI = 0; declI < item.type.pubDecls.length; declI += 1) {
                        var mainDeclIndex = item.type.pubDecls[declI];
                        if (list[mainDeclIndex] != null) continue;

                        var decl = zigAnalysis.decls[mainDeclIndex];
                        if (decl.type === typeTypeId &&
                            declCanRepresentTypeKind(zigAnalysis.types[decl.value].kind))
                        {
                            canonTypeDecls[decl.value] = mainDeclIndex;
                        }
                        var declNames = item.declNames.concat([decl.name]);
                        list[mainDeclIndex] = {
                            pkgNames: pkgNames,
                            declNames: declNames,
                        };
                        var containerType = getDeclContainerType(decl);
                        if (containerType != null) {
                            stack.push({
                                declNames: declNames,
                                type: containerType,
                            });
                        }
                    }
                }
            }
        }
        return list;
    }

    function getCanonDeclPath(index) {
        if (canonDeclPaths == null) {
            canonDeclPaths = computeCanonDeclPaths();
        }
        return canonDeclPaths[index];
    }

    function getCanonTypeDecl(index) {
        getCanonDeclPath(0);
        return canonTypeDecls[index];
    }

    function escapeHtml(text) {
        return text.replace(/[&"<>]/g, function (m) {
            return escapeHtmlReplacements[m];
        });
    }

    function shortDescMarkdown(docs) {
        var parts = docs.trim().split("\n");
        var firstLine = parts[0];
        return markdown(firstLine);
    }

    function markdown(mdText) {
        // TODO implement more
        return escapeHtml(mdText);
    }

    function activateSelectedResult() {
        if (domSectSearchResults.classList.contains("hidden")) {
            return;
        }

        var liDom = domListSearchResults.children[curSearchIndex];
        if (liDom == null && domListSearchResults.children.length !== 0) {
            liDom = domListSearchResults.children[0];
        }
        if (liDom != null) {
            var aDom = liDom.children[0];
            location.href = aDom.getAttribute("href");
            curSearchIndex = -1;
        }
        domSearch.blur();
    }

    function onSearchKeyDown(ev) {
        switch (ev.which) {
            case 13:
                if (ev.shiftKey || ev.ctrlKey || ev.altKey) return;

                // detect if this search changes anything
                var terms1 = getSearchTerms();
                startSearch();
                updateCurNav();
                var terms2 = getSearchTerms();
                // we might have to wait for onHashChange to trigger
                imFeelingLucky = (terms1.join(' ') !== terms2.join(' '));
                if (!imFeelingLucky) activateSelectedResult();

                ev.preventDefault();
                ev.stopPropagation();
                return;
            case 27:
                if (ev.shiftKey || ev.ctrlKey || ev.altKey) return;

                domSearch.value = "";
                domSearch.blur();
                curSearchIndex = -1;
                ev.preventDefault();
                ev.stopPropagation();
                startSearch();
                return;
            case 38:
                if (ev.shiftKey || ev.ctrlKey || ev.altKey) return;

                moveSearchCursor(-1);
                ev.preventDefault();
                ev.stopPropagation();
                return;
            case 40:
                if (ev.shiftKey || ev.ctrlKey || ev.altKey) return;

                moveSearchCursor(1);
                ev.preventDefault();
                ev.stopPropagation();
                return;
            default:
                if (ev.shiftKey || ev.ctrlKey || ev.altKey) return;

                curSearchIndex = -1;
                ev.stopPropagation();
                startAsyncSearch();
                return;
        }
    }

    function moveSearchCursor(dir) {
        if (curSearchIndex < 0 || curSearchIndex >= domListSearchResults.children.length) {
            if (dir > 0) {
                curSearchIndex = -1 + dir;
            } else if (dir < 0) {
                curSearchIndex = domListSearchResults.children.length + dir;
            }
        } else {
            curSearchIndex += dir;
        }
        if (curSearchIndex < 0) {
            curSearchIndex = 0;
        }
        if (curSearchIndex >= domListSearchResults.children.length) {
            curSearchIndex = domListSearchResults.children.length - 1;
        }
        renderSearchCursor();
    }
    
    function getVirtualKey(ev) {
	if ("key" in ev && typeof ev.key != "undefined") {
	    return ev.key
	}
	var c = ev.charCode || ev.keyCode;
	if (c == 27) {
	    return "Escape"
	}
	return String.fromCharCode(c)
    }

    function onWindowKeyDown(ev) {
	switch (getVirtualKey(ev)) {
	case "Escape":
	    if (ev.shiftKey || ev.ctrlKey || ev.altKey) return;
	    if (!domHelpModal.classList.contains("hidden")) {
		domHelpModal.classList.add("hidden");
		ev.preventDefault();
		ev.stopPropagation();
	    }
	    break;
	case "s":
	    if (ev.shiftKey || ev.ctrlKey || ev.altKey) return;
	    domSearch.focus();
	    domSearch.select();
	    ev.preventDefault();
	    ev.stopPropagation();
	    startAsyncSearch();
	    break;
	case "?":
	    if (!ev.shiftKey || ev.ctrlKey || ev.altKey) return;
	    ev.preventDefault();
	    ev.stopPropagation();
	    showHelpModal();
	    break;
	}
    }

    function showHelpModal() {
	domHelpModal.classList.remove("hidden");
	domHelpModal.style.left = (window.innerWidth / 2 - domHelpModal.clientWidth / 2) + "px";
        domHelpModal.style.top = (window.innerHeight / 2 - domHelpModal.clientHeight / 2) + "px";
        domHelpModal.focus();
    }

    function clearAsyncSearch() {
        if (searchTimer != null) {
            clearTimeout(searchTimer);
            searchTimer = null;
        }
    }

    function startAsyncSearch() {
        clearAsyncSearch();
        searchTimer = setTimeout(startSearch, 100);
    }
    function startSearch() {
        clearAsyncSearch();
        var oldHash = location.hash;
        var parts = oldHash.split("?");
        var newPart2 = (domSearch.value === "") ? "" : ("?" + domSearch.value);
        location.hash = (parts.length === 1) ? (oldHash + newPart2) : (parts[0] + newPart2);
    }
    function getSearchTerms() {
        var list = curNavSearch.trim().split(/[ \r\n\t]+/);
        list.sort();
        return list;
    }
    function renderSearch() {
        var matchedItems = [];
        var ignoreCase = (curNavSearch.toLowerCase() === curNavSearch);
        var terms = getSearchTerms();

        decl_loop: for (var declIndex = 0; declIndex < zigAnalysis.decls.length; declIndex += 1) {
            var canonPath = getCanonDeclPath(declIndex);
            if (canonPath == null) continue;

            var decl = zigAnalysis.decls[declIndex];
            var lastPkgName = canonPath.pkgNames[canonPath.pkgNames.length - 1];
            var fullPathSearchText = lastPkgName + "." + canonPath.declNames.join('.');
            var astNode = zigAnalysis.astNodes[decl.src];
            var fileAndDocs = zigAnalysis.files[astNode.file];
            if (astNode.docs != null) {
                fileAndDocs += "\n" + astNode.docs;
            }
            var fullPathSearchTextLower = fullPathSearchText;
            if (ignoreCase) {
                fullPathSearchTextLower = fullPathSearchTextLower.toLowerCase();
                fileAndDocs = fileAndDocs.toLowerCase();
            }

            var points = 0;
            for (var termIndex = 0; termIndex < terms.length; termIndex += 1) {
                var term = terms[termIndex];

                // exact, case sensitive match of full decl path
                if (fullPathSearchText === term) {
                    points += 4;
                    continue;
                }
                // exact, case sensitive match of just decl name
                if (decl.name == term) {
                    points += 3;
                    continue;
                }
                // substring, case insensitive match of full decl path
                if (fullPathSearchTextLower.indexOf(term) >= 0) {
                    points += 2;
                    continue;
                }
                if (fileAndDocs.indexOf(term) >= 0) {
                    points += 1;
                    continue;
                }

                continue decl_loop;
            }

            matchedItems.push({
                decl: decl,
                path: canonPath,
                points: points,
            });
        }

        if (matchedItems.length !== 0) {
            resizeDomList(domListSearchResults, matchedItems.length, '<li><a href="#"></a></li>');

            matchedItems.sort(function(a, b) {
                var cmp = operatorCompare(b.points, a.points);
                if (cmp != 0) return cmp;
                return operatorCompare(a.decl.name, b.decl.name);
            });

            for (var i = 0; i < matchedItems.length; i += 1) {
                var liDom = domListSearchResults.children[i];
                var aDom = liDom.children[0];
                var match = matchedItems[i];
                var lastPkgName = match.path.pkgNames[match.path.pkgNames.length - 1];
                aDom.textContent = lastPkgName + "." + match.path.declNames.join('.');
                aDom.setAttribute('href', navLink(match.path.pkgNames, match.path.declNames));
            }
            renderSearchCursor();

            domSectSearchResults.classList.remove("hidden");
        } else {
            domSectSearchNoResults.classList.remove("hidden");
        }
    }

    function renderSearchCursor() {
        for (var i = 0; i < domListSearchResults.children.length; i += 1) {
            var liDom = domListSearchResults.children[i];
            if (curSearchIndex === i) {
                liDom.classList.add("selected");
            } else {
                liDom.classList.remove("selected");
            }
        }
    }

    function indexNodesToFns() {
        var map = {};
        for (var i = 0; i < zigAnalysis.fns.length; i += 1) {
            var fn = zigAnalysis.fns[i];
            if (typeIsGenericFn(fn.type)) continue;
            if (map[fn.src] == null) {
                map[fn.src] = [i];
            } else {
                map[fn.src].push(i);
            }
        }
        return map;
    }

    function indexNodesToCalls() {
        var map = {};
        for (var i = 0; i < zigAnalysis.calls.length; i += 1) {
            var call = zigAnalysis.calls[i];
            var fn = zigAnalysis.fns[call.fn];
            if (map[fn.src] == null) {
                map[fn.src] = [i];
            } else {
                map[fn.src].push(i);
            }
        }
        return map;
    }

    function byNameProperty(a, b) {
        return operatorCompare(a.name, b.name);
    }
})();
