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
      translation.push('Sortierung');
      translation.push('Aufsteigend');
      translation.push('Absteigend');
      translation.push('Neuste Episode');
      translation.push('Staffeln');
      translation.push('Zufällige Episode');
      break;
    default:
      var translation = new Array();
      translation.push('Season');
      translation.push('Original title');
      translation.push('Select audio language');
      translation.push('Order');
      translation.push('Ascending');
      translation.push('Descending');
      translation.push('Latest episode');
      translation.push('Seasons');
      translation.push('Random episode');
  }

  plugin.addURI(PREFIX+":main", mainPage);
  plugin.addURI(PREFIX+":season:(.*)", episodePage);
  plugin.addURI(PREFIX+":lang:(.*):(.*)", selectLanguage);
  plugin.addURI(PREFIX+":play:(.*):(.*):(.*):([0-9]+):([0-9]+)", playEpisode);
  plugin.addURI(PREFIX+":random", pickRandom);
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

  // Pick random episode
  function pickRandom(page) {
    var data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+language+"/franchises/471/Shows/seasons.json").toString());

    var randomEpisode = 0;
    for (var i in data) {
      randomEpisode += data[i].published_episode_count;
    }
    var randomEpisode = Math.floor(Math.random() * (randomEpisode + 1));
    var randomSeason = 0;

    for (var i in data) {
      if (randomEpisode > data[i].published_episode_count) {
        randomEpisode -= data[i].published_episode_count;
      } else {
        page.redirect(PREFIX+":lang:"+i+":"+randomEpisode);
      }
    }
  }

  // Plays an episode
  function playEpisode(page, id, lang, name, season, episode) {
    page.type = "video";

    var data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+lang+"/local_playlists/"+id+".json?video_format=m3u8").toString());

    page.source = "videoparams:" + showtime.JSONEncode({
      title: decodeURIComponent(name),
      //canonicalUrl: PREFIX+":play:"+id+":"+lang+":"+name,
      canonicalUrl: PREFIX+':lang:'+season+':'+episode,
      sources: [{
        url: data.local_playlist_videos[0].url
      }]
    })
  }

  // Enumerates the audio languages
  function selectLanguage(page, season, episode) {
    page.type = "directory";
    page.contents = "items";
    page.loading = true;
    page.metadata.title = translation[2] + ' - s'+('0'+season).slice(-2)+'e'+('0'+episode).slice(-2);

    var data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+language+"/franchises/471/shows/seasons/"+season+"/episodes.json").toString());

    for (var i in data) {
      if (data[i].number_in_season == episode) {
        var titel = data[i].local_title;
        if ((titel == "") || (titel == null)) {
          titel = data[i].original_title;
        }
        page.metadata.title += ' '+titel;

        var descr = data[i].local_long_description;
        if ((descr == "") || (descr == null)) {
          descr = data[i].local_short_description;
        }
        // If the language has no long or short description we will use the english one.
        if ((descr == "") || (descr == null)) {
          descr = DescriptionFallback(season, data[i].number_in_season);
        }

        for (var i2 in data[i].local_playlists) {
          var titel = data[i].local_playlists[i2].language_code;
          if (data[i].local_playlists[i2].local_playlist_context_identifier) {
            titel += " "+data[i].local_playlists[i2].local_playlist_context_identifier;
          }
          var dur = GetDuration(data[i].local_playlists[i2].id, data[i].local_playlists[i2].language_code);
          page.appendItem(PREFIX+":play:"+data[i].local_playlists[i2].id+":"+data[i].local_playlists[i2].language_code+":"+encodeURIComponent(data[i].original_title)+":"+season+":"+episode, "video", {title: titel, duration: dur, icon: ImageId(data[i].image.riptide_image_id), description: new showtime.RichText(descr+'<br><br><br><font color="FFB000">'+translation[1]+': </font>'+data[i].original_title)});
        }

        break;
      }
    }

    page.loading = false;
  }

  // Enumerate the episodes
  function episodePage(page, season) {
    page.type = "directory";
    page.contents = "items";
    page.metadata.title = translation[0]+" "+season;

    function loadData(order) {
      page.loading = true;

      var data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+language+"/franchises/471/shows/seasons/"+season+"/episodes.json").toString());

      var sorted = new Array(data.length);
      for (var i in data) {
        sorted[parseInt(data[i].number_in_season)-1] = data[i];
      }

      if (order == "desc") {
        sorted = sorted.reverse();
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
          descr = DescriptionFallback(season, sorted[i].number_in_season);
        }
        var dur = GetDuration(sorted[i].local_playlists[0].id, sorted[i].local_playlists[0].language_code);
        page.appendItem(PREFIX+":lang:"+season+":"+sorted[i].number_in_season, "video", {title: titel, duration: dur, icon: ImageId(sorted[i].image.riptide_image_id), description: new showtime.RichText(descr+'<br><br><br><font color="FFB000">'+translation[1]+': </font>'+sorted[i].original_title)});
      }

      page.loading = false;
    }

    page.options.createMultiOpt('order', translation[3], [
        ['asc',  translation[4]],
        ['desc', translation[5]]
      ], function(order) {
        page.flush();
        loadData(order);
      }, true
    );
  }

  // Enumerates the seasons
  function mainPage(page) {
    page.type = "directory";
    page.contents = "items";
    page.metadata.title = "South Park";

    function loadData(order) {
      page.loading = true;

      page.appendItem(PREFIX+':random', 'item', {title: translation[8], icon: 'dataroot://res/svg/Shuffle.svg'});


      // Request latest episode (latest Episode on franchises.json is often wrong, so search it)
      var data = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+language+"/franchises/471/Shows/seasons.json").toString());

      try {
        // Find latest season
        var maxSeason = 0;
        for (var i in data) {
          if (data[i].published_episode_count>0) {
            if (data[i].number > maxSeason) {
              maxSeason = data[i].number;
            }
          }
        }

        // Find latest episode in latest season
        var eData = JSON.parse(showtime.httpReq("https://api.mtvnn.com/v2/site/z9pce5mcsm/"+language+"/franchises/471/shows/seasons/"+maxSeason+"/episodes.json").toString());
        var maxEpisode = 0;
        var latestEpisodeData = null;
        for (var i in eData) {
          if (eData[i].number_in_season > maxEpisode) {
            maxEpisode = eData[i].number_in_season;
            latestEpisodeData = eData[i];
          }
        }

        // Show latest episode
        var title = latestEpisodeData.local_title;
        if ((title == "") || (title == null)) {
          title = latestEpisodeData.original_title;
        }
        title = 's'+maxSeason+'e'+latestEpisodeData.number_in_season+' - '+title;

        page.appendItem(null, 'separator', {title: translation[6]});
        page.appendItem(PREFIX+":lang:"+maxSeason+":"+latestEpisodeData.number_in_season, "video", {title: title, icon: ImageId(latestEpisodeData.image.riptide_image_id), description: new showtime.RichText('<font color="FFB000">'+translation[1]+': </font>'+latestEpisodeData.original_title)});
      } catch (e) {
        print(e);
      }


      // List seasons
      page.appendItem(null, 'separator', {title: translation[7]});

      if (order == "desc") {
        data = data.reverse();
      }

      for (var i in data) {
        if (data[i].published_episode_count>0) {
          page.appendItem(PREFIX+":season:"+data[i].number, "directory", {title: translation[0]+" "+data[i].number});
        }
      }

      page.loading = false;
    }

    page.options.createMultiOpt('order', translation[3], [
        ['desc',  translation[5]],
        ['asc', translation[4]]
      ], function(order) {
        page.flush();
        loadData(order);
      }, true
    );
  }
})(this);
