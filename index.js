/*
 * A Soundcloud plugin for CSH DJ.
 *
 * Configuration: 
 *  auth: {
 *    client_id: "your_client_id_here",
 *    client_secret: "your_client_secret_here"
 *  }
 * 
 */

var Q = require("q");
var soundcloud = require("soundclouder");
var fs = require("fs");
var request = require("request");

var log, _client_id;

exports.display_name = "SoundCloud";

function format_result(result) {
	return {
		id: result.id,
		title: result.title,
		artist: result.user.username,
		thumbnail_url: result.artwork_url,
		image_url: result.artwork_url.replace("large", "t300x300")
	};
}

exports.init = function(_log, config) {
	var deferred = Q.defer();
	log = _log;

	if(!config.auth) {
		deferred.reject(new Error("Please configure auth settings."));
	}
	else if(!config.auth.client_id) {
		deferred.reject(new Error("Please configure client ID."));
	}
	else if(!config.auth.client_secret) {
		deferred.reject(new Error("Please configure client secret."));
	}
	else {
		soundcloud.init(config.auth.client_id, config.auth.client_secret, null);
		_client_id = config.auth.client_id;
		deferred.resolve();
	}

	return deferred.promise;
}

exports.search = function(max_results, query) {
	var deferred = Q.defer();

	soundcloud.get('/tracks', '', { q: query, limit: max_results }, function(error, data) {
		if(error) {
			deferred.reject(error);
			return;
		}

		function remove_unstreamable_tracks(tracks) {
			var _tracks = [];
			for(var i = 0; i < tracks.length; i++) {
				if(tracks[i].streamable) {
					_tracks.push(tracks[i]);
				}
			}
			return _tracks;
		}

		data = remove_unstreamable_tracks(data);

		deferred.resolve(data.map(format_result));
	});

	return deferred.promise;
}

exports.fetch = function(id, download_location) {
	var deferred = Q.defer();

	id = encodeURIComponent(id);
	var download_path = download_location + id + ".mp3";
	var ws = fs.createWriteStream(download_path);
	var stream_location;

	soundcloud.get('/tracks/' + id, '', {}, function(error, data) {
		if(error) {
			deferred.reject(error);
			return;
		}

		stream_location = data.stream_url;
		var opts = {
			uri : stream_location,
			qs : {
				client_id : _client_id
			},
			method : "GET",
			encoding: null
		};
		request(opts, function(err, msg, songdata) {
			if(err) {
				deferred.reject(err);
				return;
			}

			ws.write(songdata);
			deferred.resolve(download_path);
		})
	});


	return deferred.promise;
}
