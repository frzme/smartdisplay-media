/*
    * Cliff Scroller jQuery Plugin v1.0
    * @author Jaycliff Arcilla
*/

jQuery.fn.cliffScroller = function(easing_method,scroll_speed,scroll_delay) {
    
    // Mimics PHP's handy isset function
    function isset(me){
        if (me === null || me === '')return 0;
        else return 1;
    }
    
    // can the object actually be scrolled?
    var parentObject = jQuery(this);
	var t = $(this[0].cloneNode(true)).hide().css({
        'position': 'absolute',
        'width': 'auto',
        'overflow': 'visible',
        'max-width': 'inherit'
    });
	parentObject.after(t);
	
	// if t.width() > parentObject.width() the text in parentObject can not be represented in a single line, therefore scrolling makes sense
	var stop = parentObject.width() >= t.width();
	t.remove();
	if (stop) {
		return parentObject;
	}
	
    
    parentObject.wrapInner('<span class="cliff-scroller" />');
    var scrollingObject = parentObject.children('.cliff-scroller');
    var scroll_timeout = 0;
    var scroll_direction = 'left';
    var distance = 0;
    
    // Sets the default values in case the user didn't specify any specific values. Being lazy, perhaps?
    if(!isset(easing_method))easing_method='swing';
    if(!isset(scroll_speed))scroll_speed = 3000;
    if(!isset(scroll_delay))scroll_delay = 2000;
    
    scrollingObject.css({
        'display':'block',
        'position':'absolute',
        'white-space':'nowrap',
        'line-height':parentObject.css('height'),
        'left':'0px',
        'top':'0px'
    });
    
    parentObject.css({
        'position':'relative',
        'overflow':'hidden'
    });
    
    // The actual scrolling function
    function cliffScrollIt(goto_direction){
        /*
        
            The if statement below checks whether the scrolling object's width is greater than its enclosing parent's width.
            If it is, then proceed scrolling. If otherwise, don't bother.
        
        */
        if(scroll_speed>0 && scrollingObject.width()>parentObject.width()){
            
            // Sets all animation speeds to a constant rate
            // Speed is measured in pixels per second
            /*
            
                speed = distance/duration
                distance = speed*duration
                duration = distance/speed
                
                1000ms    Math.abs(distance)
                ------ x --------------------
                  1s        scroll_speed
            
            */
            var calculated_scroll_duration=1000*(Math.abs(distance)/scroll_speed);
            
            if(goto_direction=='left') scrollingObject.animate({ left: "+=" + distance + "px" }, calculated_scroll_duration, easing_method, function(){cliffScrollIt('right');});
            else scrollingObject.animate({ left: "-=" + distance + "px" }, calculated_scroll_duration, easing_method, function(){cliffScrollIt('left');});
            
        }
        //Trace
        jQuery('.sc-debug').html('direction:' + goto_direction + '<br/> distance: '+Math.abs(distance)+'<br />'+'speed: '+scroll_speed+'px/sec<br />'+'calculated duration: '+calculated_scroll_duration + "<br/> " + scrollingObject.width() + ">" + parentObject.width());
    }
    
    // Sets the delay before the scrolling object, uh, scrolls
    function setCliffScrollTimeout(goto_direction){
        scroll_timeout = setTimeout(function(){cliffScrollIt(goto_direction);},scroll_delay);
    }
    
    // Bind the custom event to the scrolling object
    scrollingObject.bind('cliffscroll', function() {
        distance = parentObject.width() - jQuery(this).width();
        jQuery(this).css({ left: 0 });
        //setScrollTextTimeout();
        cliffScrollIt(scroll_direction);
    });
    
    scrollingObject.trigger('cliffscroll');
    
    return parentObject;
};