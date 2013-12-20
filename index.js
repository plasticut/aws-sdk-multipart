var fs = require('fs');

var minPartSize = 5242880;

function multipartUpload(options, done) {
    var s3 = this;

    if (options.partSize < minPartSize || isNaN(options.partSize)) {
        options.partSize = minPartSize;
    }

    fs.stat(options.file, function (err, res) {
        if (err) { return done(err); }

        var params = {
            Bucket: options.Bucket,
            Key: options.Key,
            ACL: options.ACL,
            CacheControl: options.CacheControl,
            ContentDisposition: options.ContentDisposition,
            ContentType: options.ContentType || require('mime').lookup(options.file)
        };

        var size = res.size;
        if (size <= minPartSize) {
            fs.readFile(options.file, function(err, res) {
                if (err) { return done(err); }

                params.Body = res;

                s3.putObject(params, function(err, data) {
                    if (err) { return done(err); }

                    done(null, data);
                });
            });
        } else {
            s3.createMultipartUpload(params, function(err, data) {
                if (err) { return done(err); }

                var descriptor = {
                    count: Math.ceil(size / options.partSize),
                    partSize: options.partSize,
                    options: {
                        start: 0,
                        end: 0
                    },
                    params: {
                        Bucket: params.Bucket,
                        Key: params.Key,
                        UploadId: data.UploadId,
                        PartNumber: 1
                        //Body: null,
                        //ContentLength
                    },
                    mulipartMap: {
                        Parts: []
                    },
                    done: done,

                    file: options.file,

                    uploadPart: function () {
                        var descriptor = this;

                        descriptor.options.end = descriptor.params.PartNumber * descriptor.partSize;
                        descriptor.options.start = descriptor.options.end - descriptor.partSize;

                        fs.createReadStream(this.file, descriptor.options)
                            .on("data", function(chunk) {
                                descriptor.data.push(chunk);
                            })
                            .on("error", function(error) {
                               descriptor.uploadNextPart(error);
                            })
                            .on("end", function(chunk) {
                                descriptor.params.data = Buffer.concat(descriptor.data);
                                descriptor.s3.uploadPart(descriptor.params, function(err, data) {
                                    // repeat
                                    if (err) { return descriptor.uploadNextPart(err); }

                                    descriptor.mulipartMap.Parts[descriptor.params.PartNumber-1] = {
                                        ETag: data.ETag,
                                        PartNumber: descriptor.params.PartNumber
                                    };
                                    descriptor.uploadNextPart(null, descriptor);
                                });
                            });
                    },

                    uploadNextPart: function (error) {
                        var descriptor = this;

                        if (error) { return descriptor.abortUpload(error); }

                        descriptor.params.PartNumber++;

                        if (descriptor.params.PartNumber > descriptor.count) {
                           descriptor.completeUpload();
                        } else {
                            descriptor.uploadPart();
                        }
                    },

                    completeUpload: function() {
                        var descriptor = this;
                        descriptor.s3.completeMultipartUpload({
                            Bucket: descriptor.params.Bucket,
                            Key: descriptor.params.Key,
                            UploadId: descriptor.params.UploadId
                        }, function(err, data) {
                            if (err) { return descriptor.done(err); }

                            descriptor.done(null, data);
                        });
                    },

                    abortUpload: function(error) {
                        var descriptor = this;
                        descriptor.s3.abortMultipartUpload({
                            Bucket: descriptor.params.Bucket,
                            Key: descriptor.params.Key,
                            UploadId: descriptor.params.UploadId
                        }, function() {
                            descriptor.done(error);
                        });
                    }
                };

                descriptor.uploadPart();
            });
        }

    }); // stat

}

module.exports = function(s3) {
    s3.multipartUpload = multipartUpload;
};