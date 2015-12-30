(function(plugin) {
  var PREFIX = plugin.getDescriptor().id;

  // Overwrite this value (string) to avoid the geoip feature (e.g. DE, EN, FR, PL...)
  var language = undefined;

  plugin.addURI(PREFIX+":main", mainPage);
  plugin.addURI(PREFIX+":staffel:(.*)", episodenPage);
  plugin.addURI(PREFIX+":lang:(.*):(.*)", selectLanguage);
  plugin.addURI(PREFIX+":play:(.*):(.*):(.*)", playEpisode);
  plugin.createService("South Park", PREFIX+":main", "video", true, plugin.path + "southpark.png");

  function ImageId(id) {
    return "http://images.mtvnn.com/"+ id +"/341x192_";
  }

  // Plays an episode
  function playEpisode(page, id, lang, name) {
    page.type = "video";
    
    var data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+lang+"/local_playlists/"+id+".json?video_format=m3u8").toString());

    page.source = "videoparams:" + showtime.JSONEncode({
      title: decodeURIComponent(name),
      canonicalUrl: PREFIX+":play:"+id+":"+lang,
      sources: [{
        url: data.local_playlist_videos[0].url
      }]
    })
  }

  // Enumerates the audio languages
  function selectLanguage(page, staffel, episode) {
    page.type = "directory";
    page.contents = "items";
    page.loading = true;
    page.metadata.title = "Select audio language";

    var data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+language+"/franchises/471/shows/seasons/"+staffel+"/episodes.json").toString());

    for (var i in data) {
      if (data[i].number_in_season == episode) {
        for (var i2 in data[i].local_playlists) {
          var titel = data[i].local_playlists[i2].language_code;
          if (data[i].local_playlists[i2].local_playlist_context_identifier) {
            titel += " "+data[i].local_playlists[i2].local_playlist_context_identifier;
          }
          page.appendItem(PREFIX+":play:"+data[i].local_playlists[i2].id+":"+data[i].local_playlists[i2].language_code+":"+encodeURIComponent(data[i].original_title), "video", {title: titel, icon: ImageId(data[i].image.riptide_image_id), description: new showtime.RichText(data[i].local_long_description+'<br><br><br><font color="FFB000">Originaltitel: </font>'+data[i].original_title)});
        }
      }
    }

    page.loading = false;
  }
  
  // Enumerate the episodes
  function episodenPage(page, staffel) {
    page.type = "directory";
    page.contents = "items";
    page.metadata.title = "Season "+staffel;
    page.loading = true;

    var data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+language+"/franchises/471/shows/seasons/"+staffel+"/episodes.json").toString());

    var sorted = new Array(data.length);
    for (var i in data) {
      sorted[parseInt(data[i].number_in_season)-1] = data[i];
    }

    for (var i=0;i<sorted.length;i++) {
      if (!sorted[i]) {continue;}
      var titel = sorted[i].local_title;
      if (titel == "") {
        titel = sorted[i].original_title;
      }
      var descr = sorted[i].local_long_description;
      if (descr == "") {
        descr = sorted[i].local_short_description;
      }
      page.appendItem(PREFIX+":lang:"+staffel+":"+sorted[i].number_in_season, "video", {title: titel, icon: ImageId(sorted[i].image.riptide_image_id), description: new showtime.RichText(descr+'<br><br><br><font color="FFB000">Originaltitel: </font>'+sorted[i].original_title)});
    }

    page.loading = false;
  }

  // Enumerates the seasons
  function mainPage(page) {
    page.type = "directory";
    page.contents = "items";
    page.metadata.title = "South Park";
    page.loading = true;

    // Select language via the geoip feature of the API
    if (language == undefined) {
      var data = JSON.parse(showtime.httpReq("http://www.mtvunderthethumb.com/api/v2/utt_info/countrycode").toString());
      // Some countrycodes have no descriptions, so we overwrite them.
      if (data.countryCode) {
        switch (data.countryCode) {
          case "GB":
          case "CA":
          case "US": 
            language = "EN";
            break;

          default: 
            language = data.countryCode;
        }
        language = data.countryCode;
      }
    }

    // Request seasons
    var data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+language+"/franchises/471/Shows/seasons.json").toString());

    for (var i in data) {
      if (data[i].published_episode_count>0) {
        page.appendItem(PREFIX+":staffel:"+data[i].number, "directory", {title: 'Season '+data[i].number});
      }
    }

    page.loading = false;
  }
})(this);
