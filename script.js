setTimeout(() => {
  if (!/youtube.com/.test(window.location.href)) {
    return;
  }
  $(document).on("scroll", function () {
    $("yt-formatted-string.style-scope.ytd-rich-grid-media").each(function () {
      const isGOW = matchGOWR($(this).text());
      if (isGOW) {
        $(this).parents("ytd-rich-item-renderer.style-scope").remove();
      }
    });
    $("yt-formatted-string.style-scope.ytd-video-renderer").each(function () {
      const isGOW = matchGOWR($(this).text());
      if (isGOW) {
        $(this).parents("ytd-video-renderer.style-scope").remove();
      }
    });
  });
}, 2000);

const matchGOWR = (string) => {
  return /(GOW)|(GOD OF WAR)|(ragnarok)|(Ragnarök)|(Kratos)|(atreus)|(thor)|(\bodin\b)|(freya)|(leak)/gi.test(
    string
  );
};
