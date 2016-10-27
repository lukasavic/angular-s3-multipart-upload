#S3 Multipart uploads for Angular.

Check out example folder.

##Required API endpoint for this thing to work

You'll need a HTTP resource similar to this:
    

    public function signatureAction()
    {

        $to_sign = $this->params()->fromQuery('to_sign');
        $options    = $this->getModuleOptions();
        $signature = urlencode(base64_encode(hash_hmac("sha1", utf8_encode($to_sign), $options->s3['secretKey'], true)));

        return new JsonModel([
            'signature' => $signature
            ]);
    }



##Code example

	var c = {
	    	aws_url : "http://XXXXXX.amazonaws.com",
            file_name : 'tmp/' + file.name,
            file: file,
            auth_url : "https://my.api/signature",
            bucket : "XXXXXX",
            aws_key_id : "XXXXXXXXXXX",
            partSize: 6 * 1024 * 1024, // 6mb
            auth_url_headers : {},
            scope : $scope,
	    
            //get status like this
            on_get_upload_id : function (xhr, uploadId) {  
               $scope.$apply(function () {
					$scope.sig = uploadId;
				});
            }
      	}         

	$scope.myS3 = S3Upload.c(c);
	$scope.myS3.init_multipart_upload();

	// or like this
	$scope.$on('on_part_upload', function(event, data) { 
		console.log(data.current_part);
		$scope.$apply(function () {
		$scope.part = data.part_number;
		});
	});

##Config


   Config should be an object and contain following:
        
          Mandatory:
        
          - aws_url: 'https:mybucket.s3.amazonaws.com/'
        
          - file_name: 'ex.txt'
              Name will be saved for file in s3
        
          - file: $('#input_file')[0].files[0] or something like this :)
        
          - auth_url: '/api/transfers/signature' 
              URL on your server where is possible get signature for request
        
              e.x.backend function on python(django):
              def auth_sign(request):
                  to_sign = request.GET.get('to_sign')  # 'POST\n\n\n\nx-amz-date:Tue, 01 Sep 2015 13:47:40 GMT\n/mybucket/name_file.txt?uploads'
                  signature = base64.b64encode(hmac.new(AWS_S3_SECRET_ACCESS_KEY, to_sign, hashlib.sha1).digest())
                  return HttpResponse(signature)
        
          - bucket: 'mybucket'
        
          - aws_key_id: 'AKIAJ572SSBCX7IKLMVQ'
        
          - auth_url_headers: {'any': 'for your backend'}
              This headers will be added in GET request on "auth_url"
              It's required if your backend requires any mandatory header
        
          Optional:
        
          - partSize: integer
              Size for one part(blob) in byte
        
##[available callbacks/events]

###[successful]

          - on_get_upload_id: function(xhr, uploadId){} //xhr, upload_id when using events
              Fires when uploadId is got
              Takes xhr and uploadId which was provided by s3
        
          - on_part_upload: function(xhr, ETag, part_number){}
              Fires when part is uploaded on s3
              Takes:
                xhr
                ETag -  which was provided by s3 in header "ETag"
                part_number - sequence number of part
        
          - on_multipart_upload_complete: function(xhr)
              Fires when multipart upload is complete
        
          - on_progress: function(total, loaded)
              Fires when part is uploaded
        
###[common errors]

          - not_supported_error: function(){}
              It will be called if FileS3Upload is unsupported for current browser
              Doesn't take any arguments
        
          - on_network_error: function(xhr){}
              Fires when there is a failure on the network level
              Placed in xhr.onerror
        
          - on_non_200_error: function(xhr){}
              It will be called if response doesn't have 200 status
              If specific error isn't specified
        
          - on_abort: function(xhr){}
              Fires when xhr is aborted
        
###[specific errors]

          If this type error is specified then common error won't be called in certain place
          - on_auth_error: function(xhr){}
              It will be called if response on "auth_url" doesn't have 200 status
              Takes one argument "xhr"
        
          - on_getting_upload_id_error: function(xhr){}
              It will be called if response on "aws_url" doesn't have 200 status
              On step when uploadId should be taken
              Takes one argument "xhr"
        
          - on_absence_upload_id_error: function(xhr){}
              It will be called if response on "aws_url" has 200 status
              But doesn't contain <UploadId\>...<\/UploadId\> in body response
              Takes one argument "xhr"
        
          - on_send_part_error: function(xhr){}
              It will be called if response on "aws_url" doesn't have 200 status
              On step when part(blob) is sent to aws
              Takes one argument "xhr"
        
          - on_complete_multipart_error: function(xhr){}
              It will be called if response on "aws_url" doesn't have 200 status
              On step when request contains data for completing multipart upload
              Takes one argument "xhr"


Heavily based on https://github.com/Yuriy-Leonov/AWS-S3-Multipart-Upload 

        


