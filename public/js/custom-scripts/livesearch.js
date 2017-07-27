
var items = [];
var sortMethod = '';

$(document).ready(function() {

    $('#sortOldest').click(function() {
        $('#sortmenu').text($(this).text());
        results()
    });
    $('#sortNewest').click(function() {
        $('#sortmenu').text($(this).text());
        results();
    });
    $('#sortLowPrice').click(function() {
       $('#sortmenu').text($(this).text());
       results();
    });
    $('#sortHighPrice').click(function() {
       $('#sortmenu').text($(this).text());
       results();
    });
    $('#filtersearch').keyup(results);
});

function results(){


    clearGrid();
    loadItems();
    sort();
    makeGrid();

}

function makeGrid(){
    $('.grid').append('<div class="grid-sizer"></div>');
    $('.grid').append(items);
    $grid = $('.grid').imagesLoaded( function() {
        $grid.masonry({
            itemSelector: '.grid-item',
            percentPosition: true,
            columnWidth: '.grid-sizer',
            horizontalOrder: true,
            gutter: 10
        });
    });
}

function loadItems(){
    $.each(products, function() {

        sortMethod = $('#sortmenu').text();

        var filter = $.trim($('#filtersearch').val());

        var $panel = $(this);

        var title = $(this).find('#title').text();
        var desc = $(this).find('#description').text();

        if(title.toLowerCase().indexOf(filter.toLowerCase()) >= 0 ||
            desc.toLowerCase().indexOf(filter.toLowerCase()) >= 0) {
            items.push($panel);
        }

    });
}

function clearGrid(){
    $('.grid').empty();
    $('.grid').removeData();
    $('.grid-item').removeData();
    items = [];
}

function sort(){
    if(sortMethod === 'Lowest Price' || sortMethod === 'Highest Price'){
        items.sort(function(a,b){
            a = parseInt($(a).attr("data-price"), 10);
            b = parseInt($(b).attr("data-price"), 10);

            if(a > b) {
                return 1;
            }
            if(a < b) {
                return -1;
            }
            return 0;
        });
    }
    if(sortMethod === 'Highest Price'){
        items.reverse();
    }
    if(sortMethod === 'Oldest' || sortMethod === 'Newest'){
        items.sort(function(a,b){
            a = parseInt($(a).attr("data-date"), 10);
            b = parseInt($(b).attr("data-date"), 10);

            if(a < b) {
                return 1;
            }
            if(a > b) {
                return -1;
            }
            return 0;
        });
    }
    if(sortMethod === 'Newest'){
        items.reverse();
    }
}

