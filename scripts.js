$(document).ready(function() {

	// div element initially set hidden, then after 1 second, slowly reveal element
	setTimeout(function() {
		$("#scroll").animate({ opacity: 1 }, 1000);
	}, 2000);

    $(function(){
    	var scrollOnce = false;
  		$(window).scroll(function(){
    		if($(this).scrollTop() > 150 && !scrollOnce) {
        	scrollOnce = true;
        	$("#scroll").fadeTo(200, 0);
    		}
 		 });
	});
});