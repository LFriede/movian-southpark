(function(plugin) {
  var PREFIX = plugin.getDescriptor().id;

  // Overwrite this value (string) to avoid the geoip feature (e.g. DE, EN, FR, PL...)
  var language = undefined;

  // Select language via the geoip feature of the API
  if (language == undefined) {
    try {
      var data = JSON.parse(showtime.httpReq("http://www.mtvunderthethumb.com/api/v2/utt_info/countrycode").toString());
      if (data.countryCode) {
        language = data.countryCode;
      }
    } catch(err) {
      language = "EN";
    }
  }

  // Translate plugin
  switch (language) {
    case "DE":
      var translation = new Array();
      translation.push('Staffel');
      translation.push('Originaltitel');
      translation.push('Tonspur wählen');
      break;
    default:
      var translation = new Array();
      translation.push('Season');
      translation.push('Original title');
      translation.push('Select audio language');
  }

  plugin.addURI(PREFIX+":main", mainPage);
  plugin.addURI(PREFIX+":staffel:(.*)", episodenPage);
  plugin.addURI(PREFIX+":lang:(.*):(.*)", selectLanguage);
  plugin.addURI(PREFIX+":play:(.*):(.*):(.*)", playEpisode);
  plugin.createService("South Park", PREFIX+":main", "video", true, plugin.path + "southpark.png");

  function ImageId(id) {
    return "http://images.mtvnn.com/"+ id +"/341x192_";
  }

  function GetDuration(playlist_id, lang) {
    var data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+lang+"/local_playlists/"+playlist_id+".json?video_format=m3u8").toString());

    return data.local_playlist_videos[0].duration;
  }

  // This function will be used if there is no localized description for an episode, so it uses the english one
  function DescriptionFallback(season, episode) {
    data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/EN/franchises/471/shows/seasons/"+season+"/episodes.json").toString());
    
    for (var i in data) {
      if (data[i].number_in_season == episode) {
        var descr = data[i].local_long_description;
        if ((descr == "") || (descr == null)) {
          descr = data[i].local_short_description;
        }
        return descr;
      }
    }
  }

  // Plays an episode
  function playEpisode(page, id, lang, name) {
    page.type = "video";
    
    var data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+lang+"/local_playlists/"+id+".json?video_format=m3u8").toString());

    page.source = "videoparams:" + showtime.JSONEncode({
      title: decodeURIComponent(name),
      canonicalUrl: PREFIX+":play:"+id+":"+lang+":"+name,
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
    page.metadata.title = translation[2];

    var data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+language+"/franchises/471/shows/seasons/"+staffel+"/episodes.json").toString());

    for (var i in data) {
      if (data[i].number_in_season == episode) {
        var descr = data[i].local_long_description;
        if ((descr == "") || (descr == null)) {
          descr = data[i].local_short_description;
        }
        // If the language has no long or short description we will use the english one.
        if ((descr == "") || (descr == null)) {
          descr = DescriptionFallback(staffel, data[i].number_in_season);
        }
        
        for (var i2 in data[i].local_playlists) {
          var titel = data[i].local_playlists[i2].language_code;
          if (data[i].local_playlists[i2].local_playlist_context_identifier) {
            titel += " "+data[i].local_playlists[i2].local_playlist_context_identifier;
          }
          var dur = GetDuration(data[i].local_playlists[i2].id, data[i].local_playlists[i2].language_code);
          page.appendItem(PREFIX+":play:"+data[i].local_playlists[i2].id+":"+data[i].local_playlists[i2].language_code+":"+encodeURIComponent(data[i].original_title), "video", {title: titel, duration: dur, icon: ImageId(data[i].image.riptide_image_id), description: new showtime.RichText(descr+'<br><br><br><font color="FFB000">'+translation[1]+': </font>'+data[i].original_title)});
        }
      }
    }

    page.loading = false;
  }
  
  // Enumerate the episodes
  function episodenPage(page, staffel) {
    page.type = "directory";
    page.contents = "items";
    page.metadata.title = translation[0]+" "+staffel;
    page.loading = true;

    var data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+language+"/franchises/471/shows/seasons/"+staffel+"/episodes.json").toString());

    var sorted = new Array(data.length);
    for (var i in data) {
      sorted[parseInt(data[i].number_in_season)-1] = data[i];
    }

    for (var i=0;i<sorted.length;i++) {
      if (!sorted[i]) {continue;}
      var titel = sorted[i].local_title;
      if ((titel == "") || (titel == null)) {
        titel = sorted[i].original_title;
      }
      // Some languages seem to have just short descriptions.
      var descr = sorted[i].local_long_description;
      if ((descr == "") || (descr == null)) {
        descr = sorted[i].local_short_description;
      }
      // If the language has no long or short description we will use the english one.
      if ((descr == "") || (descr == null)) {
        descr = DescriptionFallback(staffel, sorted[i].number_in_season);
      }
      var dur = GetDuration(sorted[i].local_playlists[0].id, sorted[i].local_playlists[0].language_code);
      page.appendItem(PREFIX+":lang:"+staffel+":"+sorted[i].number_in_season, "video", {title: titel, duration: dur, icon: ImageId(sorted[i].image.riptide_image_id), description: new showtime.RichText(descr+'<br><br><br><font color="FFB000">'+translation[1]+': </font>'+sorted[i].original_title)});
    }

    page.loading = false;
  }

  // Enumerates the seasons
  function mainPage(page) {
    page.type = "directory";
    page.contents = "items";
    page.metadata.title = "South Park";
    page.loading = true;

    // Request seasons
    var data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+language+"/franchises/471/Shows/seasons.json").toString());

    for (var i in data) {
      if (data[i].published_episode_count>0) {
        page.appendItem(PREFIX+":staffel:"+data[i].number, "directory", {title: translation[0]+" "+data[i].number});
      }
    }

    page.loading = false;
  }
})(this);
