/**
 * Called when you click left to skip a song.
 * Will make an AJAX call to remove this song from the queue,
 * and then reload this page to start playing the new song.
 */
var skipSong = function() {
	console.log("Skipping");
	$.post('/skipSong')
		.done(function(data, status) {
			console.log(data);
			if (data=="0") {
				window.location.replace('/getUserPlaylists');
			} else {
				window.location.replace('/playSong');
			}
		});
}

/**
 * Called when you click right to add a song to your playlist.
 * Will make an AJAX call to add the song,
 * and then call skipSong() to move to the next track.
 */
var addSong = function() {
	console.log("Adding");
	$.post('/addSong')
		.done(skipSong);
}

$(document).ready(function() {

    var animating = false;
    var cardsCounter = 0;
    var numOfCards = 6;
    var decisionVal = 80;
    var pullDeltaX = 0;
    var deg = 0;
    var $card, $cardReject, $cardLike;

    function pullChange() {
        animating = true;
        deg = pullDeltaX / 10;
        $card.css("transform", "translateX("+ pullDeltaX +"px) rotate("+ deg +"deg)");

        var opacity = pullDeltaX / 100;
        var rejectOpacity = (opacity >= 0) ? 0 : Math.abs(opacity);
        var likeOpacity = (opacity <= 0) ? 0 : opacity;
        $cardReject.css("opacity", rejectOpacity);
        $cardLike.css("opacity", likeOpacity);
    };

    function release() {

        if (pullDeltaX >= decisionVal) {
            $card.addClass("to-right");
        } else if (pullDeltaX <= -decisionVal) {
            $card.addClass("to-left");
        }

        if (Math.abs(pullDeltaX) >= decisionVal) {
            $card.addClass("inactive");

            setTimeout(function() {
                $card.addClass("below").removeClass("inactive to-left to-right");
                cardsCounter++;
                if (cardsCounter === numOfCards) {
                    cardsCounter = 0;
                    $(".demo__card").removeClass("below");
                }
            }, 300);
        }

        if (Math.abs(pullDeltaX) < decisionVal) {
            $card.addClass("reset");
        }

        setTimeout(function() {
            $card.attr("style", "").removeClass("reset")
                .find(".demo__card__choice").attr("style", "");

            pullDeltaX = 0;
            animating = false;
        }, 300);
    };

    $(document).on("mousedown touchstart", ".demo__card:not(.inactive)", function(e) {
        if (animating) return;

        $card = $(this);
        $cardReject = $(".demo__card__choice.m--reject", $card);
        $cardLike = $(".demo__card__choice.m--like", $card);
        var startX =  e.pageX || e.originalEvent.touches[0].pageX;

        $(document).on("mousemove touchmove", function(e) {
            var x = e.pageX || e.originalEvent.touches[0].pageX;
            pullDeltaX = (x - startX);
            if (!pullDeltaX) return;
            pullChange();
        });

        $(document).on("mouseup touchend", function() {
            $(document).off("mousemove touchmove mouseup touchend");
            if (!pullDeltaX) return; // prevents from rapid click events
            release();
        });
    });

});

$(document).ready(function() {
	var leftPressed = false;
	var rightPressed = false;

	// When you click the buttons, do the things.
	$("#skipSong").on('click',skipSong);
	$("#addSong").on('click',addSong);

	// Keypress listeners for LEFT/RIGHT swiping.
	// Borrowed from stackoverflow:
	// http://stackoverflow.com/questions/1402698/binding-arrow-keys-in-js-jquery
	$(document).keydown(function(e) {
    switch(e.which) {
        case 37: // left
        if (!leftPressed) {
        		leftPressed = true;
	        	skipSong();
	        }
        	break;

        case 39: // right
        	if (!rightPressed) {
        		rightPressed = true;
        		addSong();
        	}
        	break;

        default: return; // exit this handler for other keys
    }
    e.preventDefault(); // prevent the default action (scroll / move caret)
	});

	// Keep track of whether each key has been pressed
	// so that you can't hold down one key to skip through everything.
	// (If you hold it down past the refresh it will still skip,
	//  but that's slow enough that I don't care.)
	$(document).keyup(function(e) {
  switch(e.which) {
      case 37: // left
      	leftPressed = false;
      	break;

      case 39: // right
      	rightPressed = false;
      	break;

      default: return; // exit this handler for other keys
  }
  e.preventDefault(); // prevent the default action (scroll / move caret)
	});
});