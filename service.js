angular.module('q.angularS3MultipartUploads', []).
service('S3Upload', function($window) {
	    function extend(obj1, obj2, obj3) {
	        if (typeof obj1 == 'undefined') {
	            obj1 = {};
	        }
	        if (typeof obj3 == 'object') {
	            for (var key in obj3) {
	                obj2[key] = obj3[key];
	            }
	        }
	        for (var key2 in obj2) {
	            obj1[key2] = obj2[key2];
	        }
	        return obj1;
	    }

	    function joinUrlElements() {
	        var re1 = new RegExp('^\\/|\\/$', 'g'),
	            elts = Array.prototype.slice.call(arguments);
	        return elts.map(function(element) {
	            return element.replace(re1, "");
	        }).join('/');
	    }


	    var S3Upload = {};
	    //implementation
	    S3Upload.supported = !((typeof($window.File) == 'undefined') || (typeof($window.Blob) == 'undefined') || !(!!$window.Blob.prototype.webkitSlice || !!$window.Blob.prototype.mozSlice || $window.Blob.prototype.slice));
	    if (!S3Upload.supported) {
	        throw 'FileS3Upload is unsupported for you browser';
	    }
        this.c = function(c) {
            var required_keys = ['aws_url', 'file_name', 'file', 'auth_url', 'bucket', 'aws_key_id', 'auth_url_headers', 'scope'],
                missed_keys = [],
                all_keys = [];
            var key;
            var ind;
            S3Upload.config = extend({
                    partSize: 6 * 1024 * 1024
                }, // 6 Mb
                c || {});
            console.log(S3Upload.config);
            // "Check mandatory keys in config"
            for (key in S3Upload.config) {
                if (S3Upload.config.hasOwnProperty(key)) {
                    all_keys.push(key);
                }
            }
            for (ind in required_keys) {
                if (all_keys.indexOf(required_keys[ind]) == -1) {
                    missed_keys.push(required_keys[ind]);
                }
            }
            if (missed_keys.length > 0) {
                S3Upload.config.not_supported_error && S3Upload.config.not_supported_error();
                S3Upload.config.scope.$emit('not_supported_error', {
                    missed_keys: missed_keys
                });
                throw 'Missed keys in config: ' + missed_keys.join(', ');
            }
            // END "Check mandatory keys in config"
            S3Upload.config.file_name = encodeURIComponent(S3Upload.config.file_name);
            S3Upload.config.file.name = encodeURIComponent(S3Upload.config.file.name);
            S3Upload.count_of_parts = Math.ceil(S3Upload.config.file.size / S3Upload.config.partSize) || 1;
            S3Upload.total = S3Upload.config.file.size;
            S3Upload.loaded = 0;
            S3Upload.current_part = 1;
            S3Upload.parts = [];
            S3Upload.subscribe = this.subscribe;
            console.log('Total count of parts = ' + S3Upload.count_of_parts);
            return S3Upload;
      
        };
    S3Upload.base_onreadystatechange = function(setup, xhr) {
        if (xhr.readyState == 4) {
            if (xhr.status == 200) {
                setup.f_200 && setup.f_200()
            } else if (xhr.readyState == 0) {
                S3Upload.config.scope.$emit('on_abort', {
                    xhr: xhr
                });
                S3Upload.config.on_abort && S3Upload.config.on_abort(xhr);
            } else {
                S3Upload.config.scope.$emit('on_non_200_error', {
                    xhr: xhr
                });
                S3Upload.config.on_non_200_error && S3Upload.config.on_non_200_error(xhr) || S3Upload.config[setup.name_non_200_error] && S3Upload.config[setup.name_non_200_error](xhr);
            }
        }
    };
    S3Upload._sign_request = function(method, suffix_to_sign, contentType, success_callback) {
        var xhr = S3Upload.getXmlHttp(),
            to_sign,
            signature,
            date_gmt = new Date().toUTCString();
        to_sign = method + '\n\n' + contentType + '\n\nx-amz-date:' + date_gmt + '\n/' + S3Upload.config.bucket + '/' + S3Upload.config.file_name + suffix_to_sign;
        xhr.open('GET', joinUrlElements(S3Upload.config.auth_url, '?to_sign=' + encodeURIComponent(to_sign)));
        for (var key in S3Upload.config.auth_url_headers) {
            if (S3Upload.config.auth_url_headers.hasOwnProperty(key)) {
                xhr.setRequestHeader(key, S3Upload.config.auth_url_headers[key]);
            }
        }
        xhr.onreadystatechange = function() {
            S3Upload.base_onreadystatechange({
                f_200: function() {
                    //signature will be in a format as 
                    //    {
                    //      "signature": "4FxayeX7JhFiTPl022gxEjISILk="
                    //    }
                    //
                    //signature = xhr.response.signature;
                    signature = decodeURIComponent(JSON.parse(xhr.response).signature);
                    S3Upload.config.scope.$emit('success_callback', {
                        signature: signature,
                        date_gmt: date_gmt
                    });
                    success_callback && success_callback(signature, date_gmt);
                },
                name_non_200_error: 'on_auth_error'
            }, xhr);
        };
        xhr.send(null);
    };
    S3Upload.init_multipart_upload = function() {
        S3Upload._sign_request('POST', '?uploads', '', function(signature, date_gmt) {
            console.log(signature);
            S3Upload._get_upload_id(signature, date_gmt); // as result we have S3Upload.UploadId
        });
    };
    S3Upload._send_part = function() {
        var from_byte,
            to_byte,
            suffix_to_sign,
            blob;

        if (S3Upload.parts.length == S3Upload.count_of_parts) {
            suffix_to_sign = '?uploadId=' + S3Upload.UploadId;
            S3Upload._sign_request('POST', suffix_to_sign, 'application/xml; charset=UTF-8', function(signature, date_gmt) {
                S3Upload.complete_multipart_upload(signature, date_gmt, suffix_to_sign);
            });
            console.log('Try to complete');
            return;
        }
        from_byte = (S3Upload.current_part - 1) * S3Upload.config.partSize; // S3Upload.current_part starts from 1
        to_byte = S3Upload.current_part * S3Upload.config.partSize;
        blob = S3Upload.config.file.slice(from_byte, to_byte);
        suffix_to_sign = '?partNumber=' + S3Upload.current_part + '&uploadId=' + S3Upload.UploadId;
        S3Upload._sign_request('PUT', suffix_to_sign, '', function(signature, date_gmt) {
            S3Upload._send_blob(signature, date_gmt, suffix_to_sign, blob);
        });
    };
    S3Upload._send_blob = function(signature, date_gmt, suffix, blob) {
        var xhr = S3Upload.getXmlHttp(),
            ETag;
        xhr.open('PUT', joinUrlElements(S3Upload.config.aws_url, '/' + S3Upload.config.file_name + suffix));
        xhr.setRequestHeader('Authorization', 'AWS ' + S3Upload.config.aws_key_id + ':' + signature);
        xhr.setRequestHeader('x-amz-date', date_gmt);
        if (xhr.upload) {
            xhr.upload.addEventListener("progress", function(prog) {
                //                    value = ~~((prog.loaded / prog.total) * 100);
                S3Upload.config.scope.$emit('on_progress', {
                    total: S3Upload.total,
                    loaded: S3Upload.loaded + prog.loaded
                });
                S3Upload.config.on_progress && S3Upload.config.on_progress(S3Upload.total, S3Upload.loaded + prog.loaded);
            }, false);
        }
        xhr.onreadystatechange = function() {
            S3Upload.base_onreadystatechange({
                f_200: function() {
                    ETag = xhr.getResponseHeader('ETag');
                    console.log('ETag = ' + ETag + ' For part #' + S3Upload.current_part);
                    S3Upload.parts.push(ETag);
                    S3Upload.loaded += blob.size;
                   S3Upload.config.scope.$emit('on_part_upload', {
                        xhr: xhr,
                        ETag: ETag,
                        part_number: S3Upload.current_part
                    });
                    S3Upload.config.scope.$emit('on_progress', {
                        total: S3Upload.total,
                        loaded: S3Upload.loaded
                    });
                    S3Upload.config.on_progress && S3Upload.config.on_progress(S3Upload.total, S3Upload.loaded);
                    // put it here becouse in future we should keep for unuploaded parts
                    
                    S3Upload.config.on_part_upload && S3Upload.config.on_part_upload(xhr, ETag, S3Upload.current_part);
                    S3Upload.current_part += 1;
                    setTimeout(function() { // to avoid recursion
                        S3Upload._send_part();
                    }, 50);
                },
                name_non_200_error: 'on_send_part_error'
            }, xhr);
        };
        xhr.send(blob);
    };
    S3Upload._get_upload_id = function(signature, date_gmt) {
        var xhr = S3Upload.getXmlHttp(),
            uploadId;
        xhr.open('POST', joinUrlElements(S3Upload.config.aws_url, '/' + S3Upload.config.file_name + '?uploads'));
        xhr.setRequestHeader('Authorization', 'AWS ' + S3Upload.config.aws_key_id + ':' + signature);
        xhr.setRequestHeader('x-amz-date', date_gmt);
        xhr.onreadystatechange = function() {
            S3Upload.base_onreadystatechange({
                f_200: function() {
                    uploadId = xhr.response.match(/<UploadId\>(.+)<\/UploadId\>/);
                    if (uploadId && uploadId[1]) {
                        S3Upload.UploadId = uploadId[1];
                        console.log('Got UploadId: ' + S3Upload.UploadId);
                        S3Upload.config.scope.$emit('on_get_upload_id', {
                            xhr: xhr,
                            upload_id: S3Upload.UploadId
                        });
                        S3Upload.config.on_get_upload_id && S3Upload.config.on_get_upload_id(xhr, S3Upload.UploadId);
                        setTimeout(function() {
                            S3Upload._send_part();
                        }, 50);
                    } else {
                        S3Upload.config.scope.$emit('on_non_200_error', {
                            xhr: xhr
                        });
                        S3Upload.config.scope.$emit('on_absence_upload_id_error', {
                            xhr: xhr
                        });
                        S3Upload.config.on_non_200_error && S3Upload.config.on_non_200_error(xhr) || S3Upload.config.on_absence_upload_id_error && S3Upload.config.on_absence_upload_id_error(xhr);
                    }
                },
                name_non_200_error: 'on_getting_upload_id_error'
            }, xhr);
        };
        xhr.send(null);
    };
    S3Upload.complete_multipart_upload = function(signature, date_gmt, suffix) {
        var xhr = S3Upload.getXmlHttp(),
            completeDoc = '<CompleteMultipartUpload>';
        xhr.open('POST', joinUrlElements(S3Upload.config.aws_url, '/' + S3Upload.config.file_name + suffix));
        xhr.setRequestHeader('Authorization', 'AWS ' + S3Upload.config.aws_key_id + ':' + signature);
        xhr.setRequestHeader('Content-Type', 'application/xml; charset=UTF-8');
        xhr.setRequestHeader('x-amz-date', date_gmt);
        xhr.onreadystatechange = function() {
            S3Upload.base_onreadystatechange({
                f_200: function() {
                    console.log('END');
                    S3Upload.config.scope.$emit('on_multipart_upload_complete', {
                        xhr: xhr
                    });
                    S3Upload.config.on_multipart_upload_complete && S3Upload.config.on_multipart_upload_complete(xhr);
                },
                name_non_200_error: 'on_complete_multipart_error'
            }, xhr);
        };
        S3Upload.parts.forEach(function(ETag, partNumber) {
            completeDoc += '<Part><PartNumber>' + (partNumber + 1) + '</PartNumber><ETag>' + ETag + '</ETag></Part>';
        });
        completeDoc += '</CompleteMultipartUpload>';
        xhr.send(completeDoc);
    };
    S3Upload.abort = function() {
        S3Upload.xhr.abort();
    };
    S3Upload.getXmlHttp = function() {
        var xmlhttp;
        try {
            xmlhttp = new ActiveXObject("Msxml2.XMLHTTP");
        } catch (e) {
            try {
                xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
            } catch (E) {
                xmlhttp = false;
            }
        }
        if (!xmlhttp && typeof XMLHttpRequest != 'undefined') {
            xmlhttp = new XMLHttpRequest();
        }
        xmlhttp.onerror = function() {
            S3Upload.config.scope.$emit('on_network_error', {
                xhr: xhr
            });
            S3Upload.config.on_network_error && S3Upload.config.on_network_error(xhr);
        };
        S3Upload.xhr = xmlhttp;
        return xmlhttp;
    };
})