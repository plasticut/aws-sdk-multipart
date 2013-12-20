aws-sdk-multipart
=================

aws-sdk multipart upload


    var s3 = new AWS.S3({
        accessKeyId: options.publicKey,
        secretAccessKey: options.privateKey
    });
    require("./s3multipart")(s3);


    s3.multipartUpload({
        file: "your input file name",
        Bucket: "your bucket",
        Key: "your s3 file key",
        CacheControl: "public",
        ContentDisposition: "attachment",
        ACL: "public-read"
    }, function(err, res){

    });
