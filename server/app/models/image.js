
/**
 * Module dependencies
 */
var coBusboy = require('co-busboy')
  , coFs = require('co-fs')
  , config = require('../../config/config')[process.env.NODE_ENV || 'development']
  , fs = require('fs')
  , gm = require('gm')
  , mime = require('mime')
  , mongoose = require('mongoose')
  , msg = require('../../config/messages')
  , Promise = require('bluebird')
  , sanitize = require('../../assets/lib/sanitizer-extended')
  , Schema = mongoose.Schema;

/**
 * Image validation error
 */
var ImageError = function (message, status, path) {
  this.name = 'ImageError';
  this.message = message || '';
  this.path = path || '';
  this.status = status || 400; // 400 Bad Request
};
ImageError.prototype = Error.prototype;

/**
 * Image schema
 */
var ImageSchema = new Schema({
  alt: String,
  encoding: String,
  files: [{
    filename: String,
    geometry: {
      height: Number,
      width: Number
    },
    size: Number,
    src: String,
  }],
  mimetype: String,
  order: Number,
  type: String
});

/**
 * Pre-validation hook; Sanitizers
 */
ImageSchema.pre('validate', function (next) {
  this.alt = sanitize.escape(this.alt);
  this.encoding = sanitize.escape(this.encoding);
  this.mimetype = sanitize.escape(this.mimetype);
  this.type = sanitize.escape(this.type);
  next();
});

/**
 * Image methods
 */
ImageSchema.methods = {

  /**
   * Yieldable generator function for resizing an existing image file
   *
   * @param   {object}  image                      -  file object that contains reference to image that will be resized
   * @param   {object}  [opts]                     -  image options
   * @param   {boolean} [opts.crop=true]           -  create an image that crops to exact dimensions
   * @param   {object}  [opts.geometry]            -  image geometry
   * @param   {number}  [opts.geometry.height=50]  -  image height
   * @param   {number}  [opts.geometry.width=50]   -  image width
   * @return  {object}                             -  file object within image.files array
   */
  resize: function *(image, opts) {
    opts = opts || {};
    opts.crop = opts.crop === false ? false : true;
    opts.geometry = opts.geometry || {};
    opts.geometry.height = opts.geometry.height || 50;
    opts.geometry.width = opts.geometry.width || 50;

    var dir = config.path.upload + ( this.type ? '/' + this.type : '' )
      , extension = mime.extension(this.mimetype)
      , file = { _id: mongoose.Types.ObjectId() }
      , filename = file.filename = file._id + '.' + ( extension === 'jpeg' ? 'jpg' : extension )
      , geometry = Promise.defer()
      , path = dir + '/' + filename
      , size = Promise.defer()
      , source = dir + '/' + image.filename // path of image referenced by 'image' parameter
      , type = this.type;

    file.src = '/assets/img/' + ( type ? type + '/' : '' ) + filename;

    fs.exists(source, function (exists) {
      if (!exists) return size.reject(new ImageError(msg.image.unknownError, 400)); // 400 Bad Request
      var _image = gm(fs.createReadStream(source));
      if (opts.crop === true) _image.resize(opts.geometry.width, opts.geometry.height, '^')
        .gravity('Center')
        .crop(opts.geometry.width, opts.geometry.width);
      else _image.resize(opts.geometry.width, opts.geometry.height);
      _image.stream(function (err, stdout, stderr) {
        if (err) return size.reject(new ImageError(msg.image.unknownError, 400)); // 400 Bad Request
        var writeStream = fs.createWriteStream(path);
        stdout.on('error', function (err) {
          size.reject(new ImageError(msg.image.unknownError, 400, path)); // 400 Bad Request
        });
        stdout.on('end', function () {
          size.resolve(this.bytesRead);
          fs.exists(path, function (exists) {
            if (exists) gm(fs.createReadStream(path)).size({ buffer: true }, function (err, size) {
              if (err) return geometry.reject(new ImageError(msg.image.unknownError, 400, path)); // 400 Bad Request
              geometry.resolve(size);
            });
          });
        });
        stdout.pipe(writeStream);
      });
    });

    // promised values
    file.size = yield size.promise;
    file.geometry = yield geometry.promise;
    this.files.push(file);
    return file;
  },

  /**
   * Handler for form data containing an image
   * ! LIMITED TO SINGLE IMAGE UPLOADS !
   *
   * @param   {object}  ctx                             -  koa context object
   * @param   {object}  [opts]                          -  image options
   * @param   {string}  [opts.alt=image]                -  image alt text
   * @param   {string}  [opts.type]                     -  type of image, and name of subdirectory in which to store
   * @param   {object}  [opts.limits]                   -  busboy limits
   * @param   {number}  [opts.limits.fileSize=2097152]  -  max file size in bytes
   * @return  {object}                                  -  file object within image.files array
   */
  stream: function *(ctx, opts) {
    opts = opts || {};
    opts.alt = this.alt = opts.alt || 'image';
    opts.type = this.type = opts.type || '';
    opts.limits = opts.limits || {};
    opts.limits.files = 1;
    opts.limits.fileSize = opts.limits.fileSize || 2097152; // 2 MB
    this.files = [];

    var dir = config.path.upload + ( opts.type ? '/' + opts.type : '' )
      , file = { _id: mongoose.Types.ObjectId() }
      , geometry = Promise.defer()
      , part, parts = coBusboy(ctx, { limits: opts.limits })
      , size = Promise.defer()
      , types = [ 'image/png', 'image/jpeg', 'image/gif' ];

    while (part = yield parts) {
      if (!part.length) {
        if (part.mime === 'application/octet-stream' && part.filename) part.mime = mime.lookup(part.filename);

        if (types.indexOf(part.mime) >= 0) {
          var extension = mime.extension(part.mime)
            , filename = file.filename = file._id + '.' + ( extension === 'jpeg' ? 'jpg' : extension )
            , path = dir + '/' + filename;
          this.encoding = part.encoding;
          this.mimetype = part.mime;
          file.src = '/assets/img/' + ( opts.type ? opts.type + '/' : '' ) + filename;

          // busboy stream events
          part.on('error', function (err) {
            size.reject(new ImageError(msg.image.unknownError, 400, path)); // 400 Bad Request
          });
          part.on('end', function () {
            if (this.truncated) size.reject(new ImageError(msg.image.exceedsFileSize(opts.limits.fileSize), 413, path)); // 413 Request Entity Too Large
          });

          gm(part).strip().stream(function (err, stdout, stderr) {
            if (err) return size.reject(new ImageError(msg.image.unknownError, 400, path)); // 400 Bad Request
            var writeStream = fs.createWriteStream(path);
            stdout.on('error', function (err) {
              size.reject(new ImageError(msg.image.unknownError, 400, path)); // 400 Bad Request
            });
            stdout.on('end', function () {
              size.resolve(this.bytesRead);
              fs.exists(path, function (exists) {
                if (exists) gm(fs.createReadStream(path)).size({ buffer: true }, function (err, size) {
                  if (err) return geometry.reject(new ImageError(msg.image.unknownError, 400, path)); // 400 Bad Request
                  geometry.resolve(size);
                });
              });
            });
            stdout.pipe(writeStream);
          });

        } else {
          part.resume();
          throw new ImageError(msg.image.mimeError(part.mime), 415); // 415 Unsupported Media Type
        }
      } else {
        switch (part[0]) {
          case 'alt':
            this.alt = part[1];
            break;
          case 'order':
            this.order = part[1];
            break;
        }
      }
    }

    // promised values
    file.size = yield size.promise;
    file.geometry = yield geometry.promise;
    this.files.push(file);
    return file;
  },

  /**
   * Deletes image files, and removes file metadata
   *
   * @return {object} - an image object that has been stripped of files and file metadata;
   */
  unlink: function *() {
    var dir = config.path.upload + ( this.type ? '/' + this.type : '' )
      , i = this.files.length;
    while (i--) if (this.files[i].filename && (yield coFs.exists(dir + '/' + this.files[i].filename))) yield coFs.unlink(dir + '/' + this.files[i].filename);
    this.files = [];
    if (this.mimetype) this.mimetype = undefined;
    if (this.encoding) this.encoding = undefined;
    return this;
  }
};

mongoose.model('Image', ImageSchema);
