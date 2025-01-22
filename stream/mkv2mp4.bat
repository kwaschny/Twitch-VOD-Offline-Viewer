@echo off

ffmpeg -i .\video.mkv -map 0:v -c copy out.webm
ffmpeg -i .\video.mkv -map 0:a -c copy out.aac
ffmpeg -i .\out.webm -i .\out.aac -c:v copy -c:a copy video.mp4

del out.webm
del out.aac

pause