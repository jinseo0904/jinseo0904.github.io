$(document).ready(function() {


	// div element initially set hidden, then after 1 second, slowly reveal element
	setTimeout(function() {
        if($(this).scrollTop() <= 100) {
                $("#scroll").animate({ opacity: 1 }, 600);
            }
	}, 1100);

    $(function(){
    	var scrollOnce = false;
  		$(window).scroll(function(){
    		if($(this).scrollTop() > 100 && !scrollOnce) {
        	scrollOnce = true;
        	$("#scroll").fadeTo(200, 0);
    		}
 		 });
	});
});