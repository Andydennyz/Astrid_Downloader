package com.mediadock.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.ContentUris;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.util.Size;
import android.webkit.MimeTypeMap;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "MediaDockStorage",
    permissions = {
        @Permission(
            alias = "legacyStorage",
            strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }
        ),
        @Permission(
            alias = "legacyMediaRead",
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE }
        ),
        @Permission(
            alias = "mediaAudio",
            strings = { Manifest.permission.READ_MEDIA_AUDIO }
        ),
        @Permission(
            alias = "mediaVideo",
            strings = { Manifest.permission.READ_MEDIA_VIDEO }
        ),
        @Permission(
            alias = "selectedVideo",
            strings = { Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED }
        )
    }
)
public class MediaDockStoragePlugin extends Plugin {
    private static final String TAG = "MediaDockStorage";
    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void requestLegacyStoragePermission(PluginCall call) {
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.P
            || getPermissionState("legacyStorage") == PermissionState.GRANTED) {
            resolvePermission(call, true);
            return;
        }
        requestPermissionForAlias("legacyStorage", call, "storagePermissionResult");
    }

    @PluginMethod
    public void requestDeviceMediaPermissions(PluginCall call) {
        if (hasAudioMediaPermission() && hasVideoMediaPermission()) {
            resolveDeviceMediaAccess(call);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            String[] aliases = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                ? new String[] { "mediaAudio", "mediaVideo", "selectedVideo" }
                : new String[] { "mediaAudio", "mediaVideo" };
            requestPermissionForAliases(aliases, call, "deviceMediaPermissionResult");
            return;
        }
        requestPermissionForAlias(
            "legacyMediaRead",
            call,
            "deviceMediaPermissionResult"
        );
    }

    @PermissionCallback
    private void deviceMediaPermissionResult(PluginCall call) {
        resolveDeviceMediaAccess(call);
    }

    private void resolveDeviceMediaAccess(PluginCall call) {
        boolean audioGranted = hasAudioMediaPermission();
        boolean fullVideoGranted = hasFullVideoMediaPermission();
        boolean selectedVideoGranted = hasSelectedVideoPermission();
        boolean videoGranted = fullVideoGranted || selectedVideoGranted;
        JSObject result = new JSObject();
        result.put("granted", audioGranted || videoGranted);
        result.put("audioGranted", audioGranted);
        result.put("videoGranted", videoGranted);
        result.put("videoSelectedOnly", selectedVideoGranted && !fullVideoGranted);
        call.resolve(result);
    }

    private boolean hasAudioMediaPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return getPermissionState("mediaAudio") == PermissionState.GRANTED;
        }
        return getPermissionState("legacyMediaRead") == PermissionState.GRANTED;
    }

    private boolean hasFullVideoMediaPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return getPermissionState("mediaVideo") == PermissionState.GRANTED;
        }
        return getPermissionState("legacyMediaRead") == PermissionState.GRANTED;
    }

    private boolean hasSelectedVideoPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
            && getPermissionState("selectedVideo") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void listDeviceMedia(PluginCall call) {
        String kind = call.getString("kind", "all");
        Integer offsetValue = call.getInt("offset", 0);
        Integer limitValue = call.getInt("limit", 30);
        int offset = offsetValue == null ? 0 : offsetValue;
        int limit = limitValue == null ? 30 : limitValue;
        if (!kind.equals("all") && !kind.equals("audio") && !kind.equals("video")) {
            call.reject("Choose audio, video, or all device media.");
            return;
        }
        if (offset < 0 || limit < 1 || limit > 100) {
            call.reject("The device media page is invalid.");
            return;
        }

        boolean includeAudio = (kind.equals("all") || kind.equals("audio"))
            && hasAudioMediaPermission();
        boolean includeVideo = (kind.equals("all") || kind.equals("video"))
            && hasVideoMediaPermission();
        if ((kind.equals("audio") && !includeAudio)
            || (kind.equals("video") && !includeVideo)
            || (!includeAudio && !includeVideo)) {
            call.reject("Allow MediaDock access to the selected device media.");
            return;
        }

        ioExecutor.execute(() -> {
            try {
                List<DeviceMediaRow> rows = new ArrayList<>();
                boolean hasMore = false;
                if (includeVideo) {
                    DeviceMediaPage page = queryDeviceMedia("video", offset, limit);
                    rows.addAll(page.rows);
                    hasMore = page.hasMore;
                }
                if (includeAudio) {
                    DeviceMediaPage page = queryDeviceMedia("audio", offset, limit);
                    rows.addAll(page.rows);
                    hasMore = hasMore || page.hasMore;
                }
                Collections.sort(
                    rows,
                    Comparator.comparingLong((DeviceMediaRow row) -> row.dateAdded).reversed()
                );
                JSArray items = new JSArray();
                for (DeviceMediaRow row : rows) {
                    items.put(row.value);
                }
                JSObject result = new JSObject();
                result.put("items", items);
                result.put("nextOffset", offset + limit);
                result.put("hasMore", hasMore);
                call.resolve(result);
            } catch (Exception error) {
                String message = error.getMessage();
                call.reject(
                    message == null
                        ? "Could not read the device media library."
                        : message
                );
            }
        });
    }

    private boolean hasVideoMediaPermission() {
        return hasFullVideoMediaPermission() || hasSelectedVideoPermission();
    }

    private DeviceMediaPage queryDeviceMedia(String kind, int offset, int limit)
        throws Exception {
        boolean video = kind.equals("video");
        Uri collection = video
            ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI
            : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        String[] projection = video
            ? new String[] {
                MediaStore.MediaColumns._ID,
                MediaStore.MediaColumns.DISPLAY_NAME,
                MediaStore.MediaColumns.TITLE,
                MediaStore.MediaColumns.MIME_TYPE,
                MediaStore.MediaColumns.DURATION,
                MediaStore.MediaColumns.SIZE,
                MediaStore.MediaColumns.DATE_ADDED
            }
            : new String[] {
                MediaStore.MediaColumns._ID,
                MediaStore.MediaColumns.DISPLAY_NAME,
                MediaStore.MediaColumns.TITLE,
                MediaStore.MediaColumns.MIME_TYPE,
                MediaStore.MediaColumns.DURATION,
                MediaStore.MediaColumns.SIZE,
                MediaStore.MediaColumns.DATE_ADDED,
                MediaStore.Audio.AudioColumns.ARTIST,
                MediaStore.Audio.AudioColumns.ALBUM_ID
            };
        Cursor cursor = queryMediaCursor(collection, projection, offset, limit + 1);
        if (cursor == null) {
            throw new IllegalStateException("Android could not read device media.");
        }

        List<DeviceMediaRow> rows = new ArrayList<>();
        boolean hasMore;
        try (Cursor mediaCursor = cursor) {
            int count = 0;
            hasMore = mediaCursor.getCount() > limit;
            while (mediaCursor.moveToNext() && count < limit) {
                long id = cursorLong(mediaCursor, MediaStore.MediaColumns._ID);
                String filename = cursorString(
                    mediaCursor,
                    MediaStore.MediaColumns.DISPLAY_NAME,
                    "media-" + id
                );
                String title = cursorString(
                    mediaCursor,
                    MediaStore.MediaColumns.TITLE,
                    filename
                );
                String mimeType = cursorString(
                    mediaCursor,
                    MediaStore.MediaColumns.MIME_TYPE,
                    video ? "video/*" : "audio/*"
                );
                long durationMs = cursorLong(
                    mediaCursor,
                    MediaStore.MediaColumns.DURATION
                );
                long sizeBytes = cursorLong(mediaCursor, MediaStore.MediaColumns.SIZE);
                long dateAdded = cursorLong(
                    mediaCursor,
                    MediaStore.MediaColumns.DATE_ADDED
                ) * 1000L;
                long albumId = video
                    ? -1
                    : cursorLong(mediaCursor, MediaStore.Audio.AudioColumns.ALBUM_ID);
                Uri mediaUri = ContentUris.withAppendedId(collection, id);

                JSObject item = new JSObject();
                item.put("id", kind + ":" + id);
                item.put("kind", kind);
                item.put("title", title);
                item.put(
                    "creator",
                    video
                        ? "On this device"
                        : cursorString(
                            mediaCursor,
                            MediaStore.Audio.AudioColumns.ARTIST,
                            "Unknown artist"
                        )
                );
                item.put("filename", filename);
                item.put("uri", mediaUri.toString());
                item.put(
                    "thumbnailUrl",
                    getMediaThumbnail(mediaUri, kind, id, albumId)
                );
                item.put("mimeType", mimeType);
                item.put("durationSec", Math.max(0, durationMs / 1000L));
                item.put("sizeBytes", Math.max(0, sizeBytes));
                item.put("dateAdded", dateAdded);
                rows.add(new DeviceMediaRow(item, dateAdded));
                count++;
            }
        }
        return new DeviceMediaPage(rows, hasMore);
    }

    private Cursor queryMediaCursor(
        Uri collection,
        String[] projection,
        int offset,
        int limit
    ) {
        ContentResolver resolver = getContext().getContentResolver();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Bundle queryArgs = new Bundle();
            queryArgs.putString(
                ContentResolver.QUERY_ARG_SQL_SORT_ORDER,
                MediaStore.MediaColumns.DATE_ADDED + " DESC"
            );
            queryArgs.putInt(ContentResolver.QUERY_ARG_LIMIT, limit);
            queryArgs.putInt(ContentResolver.QUERY_ARG_OFFSET, offset);
            return resolver.query(collection, projection, queryArgs, null);
        }
        String sortOrder = MediaStore.MediaColumns.DATE_ADDED
            + " DESC LIMIT " + limit + " OFFSET " + offset;
        return resolver.query(collection, projection, null, null, sortOrder);
    }

    private static String cursorString(Cursor cursor, String column, String fallback) {
        int index = cursor.getColumnIndex(column);
        if (index < 0 || cursor.isNull(index)) return fallback;
        String value = cursor.getString(index);
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private static long cursorLong(Cursor cursor, String column) {
        int index = cursor.getColumnIndex(column);
        return index < 0 || cursor.isNull(index) ? 0 : cursor.getLong(index);
    }

    private String getMediaThumbnail(Uri mediaUri, String kind, long mediaId, long albumId) {
        Bitmap bitmap = null;
        try {
            if (kind.equals("video")) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    bitmap = getContext().getContentResolver().loadThumbnail(
                        mediaUri,
                        new Size(320, 180),
                        null
                    );
                } else {
                    bitmap = MediaStore.Video.Thumbnails.getThumbnail(
                        getContext().getContentResolver(),
                        mediaId,
                        MediaStore.Video.Thumbnails.MINI_KIND,
                        null
                    );
                }
            } else if (albumId >= 0) {
                Uri albumArtUri = ContentUris.withAppendedId(
                    Uri.parse("content://media/external/audio/albumart"),
                    albumId
                );
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    bitmap = getContext().getContentResolver().loadThumbnail(
                        albumArtUri,
                        new Size(240, 240),
                        null
                    );
                } else {
                    bitmap = decodeAudioThumbnail(albumArtUri);
                }
            }
            if (bitmap == null) return "";
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 72, output);
            return "data:image/jpeg;base64,"
                + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
        } catch (Exception error) {
            Log.w(TAG, "Could not load a device media thumbnail.", error);
            return "";
        } finally {
            if (bitmap != null) bitmap.recycle();
        }
    }

    private Bitmap decodeAudioThumbnail(Uri albumArtUri) throws Exception {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream input = getContext().getContentResolver().openInputStream(albumArtUri)) {
            if (input == null) return null;
            BitmapFactory.decodeStream(input, null, bounds);
        }
        int sampleSize = 1;
        while (bounds.outWidth / sampleSize > 480 || bounds.outHeight / sampleSize > 480) {
            sampleSize *= 2;
        }
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sampleSize;
        try (InputStream input = getContext().getContentResolver().openInputStream(albumArtUri)) {
            return input == null ? null : BitmapFactory.decodeStream(input, null, options);
        }
    }

    private static class DeviceMediaRow {
        final JSObject value;
        final long dateAdded;

        DeviceMediaRow(JSObject value, long dateAdded) {
            this.value = value;
            this.dateAdded = dateAdded;
        }
    }

    private static class DeviceMediaPage {
        final List<DeviceMediaRow> rows;
        final boolean hasMore;

        DeviceMediaPage(List<DeviceMediaRow> rows, boolean hasMore) {
            this.rows = rows;
            this.hasMore = hasMore;
        }
    }

    @PermissionCallback
    private void storagePermissionResult(PluginCall call) {
        boolean granted = Build.VERSION.SDK_INT > Build.VERSION_CODES.P
            || getPermissionState("legacyStorage") == PermissionState.GRANTED;
        if (!granted) {
            call.reject("Allow MediaDock storage access to save downloads.");
            return;
        }
        if (call.getString("url") == null) {
            resolvePermission(call, true);
            return;
        }
        download(
            call,
            call.getString("url"),
            call.getString("filename"),
            call.getString("relativeDirectory")
        );
    }

    @PluginMethod
    public void downloadToDownloads(PluginCall call) {
        String url = call.getString("url");
        String filename = call.getString("filename");
        String relativeDirectory = call.getString("relativeDirectory");
        try {
            validateUrl(url);
            validateFilename(filename);
            validateDirectory(relativeDirectory);
        } catch (IllegalArgumentException error) {
            call.reject(error.getMessage());
            return;
        }

        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P
            && getPermissionState("legacyStorage") != PermissionState.GRANTED) {
            requestPermissionForAlias("legacyStorage", call, "downloadPermissionResult");
            return;
        }
        download(call, url, filename, relativeDirectory);
    }

    @PermissionCallback
    private void downloadPermissionResult(PluginCall call) {
        if (getPermissionState("legacyStorage") != PermissionState.GRANTED) {
            call.reject("Allow MediaDock storage access to save downloads.");
            return;
        }
        download(
            call,
            call.getString("url"),
            call.getString("filename"),
            call.getString("relativeDirectory")
        );
    }

    private void resolvePermission(PluginCall call, boolean granted) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void deleteFromDownloads(PluginCall call) {
        String relativePath = call.getString("relativePath");
        try {
            validateRelativePath(relativePath);
        } catch (IllegalArgumentException error) {
            call.reject(error.getMessage());
            return;
        }

        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P
            && getPermissionState("legacyStorage") != PermissionState.GRANTED) {
            requestPermissionForAlias("legacyStorage", call, "deletePermissionResult");
            return;
        }
        delete(call, relativePath);
    }

    @PluginMethod
    public void getDownloadUri(PluginCall call) {
        String relativePath = call.getString("relativePath");
        try {
            validateRelativePath(relativePath);
        } catch (IllegalArgumentException error) {
            call.reject(error.getMessage());
            return;
        }
        ioExecutor.execute(() -> {
            try {
                JSObject result = new JSObject();
                result.put("uri", findDownloadUri(relativePath).toString());
                call.resolve(result);
            } catch (Exception error) {
                String message = error.getMessage();
                call.reject(message == null ? "Could not open the saved MediaDock file." : message);
            }
        });
    }

    @PermissionCallback
    private void deletePermissionResult(PluginCall call) {
        if (getPermissionState("legacyStorage") != PermissionState.GRANTED) {
            call.reject("Allow MediaDock storage access to remove this download.");
            return;
        }
        delete(call, call.getString("relativePath"));
    }

    @Override
    protected void handleOnDestroy() {
        ioExecutor.shutdown();
        super.handleOnDestroy();
    }

    private void download(
        PluginCall call,
        String url,
        String filename,
        String relativeDirectory
    ) {
        ioExecutor.execute(() -> {
            try {
                String path = downloadFile(url, filename, relativeDirectory);
                JSObject result = new JSObject();
                result.put("path", path);
                call.resolve(result);
            } catch (Exception error) {
                String message = error.getMessage();
                call.reject(message == null ? "Could not download the file to Downloads/MediaDock." : message);
            }
        });
    }

    private String downloadFile(String downloadUrl, String filename, String relativeDirectory)
        throws Exception {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            File downloads = Environment.getExternalStoragePublicDirectory(
                Environment.DIRECTORY_DOWNLOADS
            );
            File directory = new File(downloads, "MediaDock/" + relativeDirectory);
            if (!directory.exists() && !directory.mkdirs()) {
                throw new IllegalStateException("Could not create the MediaDock download folder.");
            }
            File target = new File(directory, filename);
            File temporary = new File(directory, "." + filename + ".part");
            try {
                HttpURLConnection connection = openConnection(downloadUrl);
                try (InputStream input = connection.getInputStream();
                     OutputStream output = new FileOutputStream(temporary)) {
                    copy(input, output);
                } finally {
                    connection.disconnect();
                }
                if (target.exists() && !target.delete()) {
                    throw new IllegalStateException("Could not replace the existing MediaDock file.");
                }
                if (!temporary.renameTo(target)) {
                    throw new IllegalStateException("Could not finish saving the MediaDock download.");
                }
            } finally {
                if (temporary.exists()) temporary.delete();
            }
            return Uri.fromFile(target).toString();
        }

        ContentResolver resolver = getContext().getContentResolver();
        Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
        String relativePath = ensureTrailingSlash(
            Environment.DIRECTORY_DOWNLOADS + "/MediaDock/" + relativeDirectory
        );
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType(filename));
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri target = resolver.insert(collection, values);
        if (target == null) {
            throw new IllegalStateException("Android could not create the MediaDock download file.");
        }

        HttpURLConnection connection = null;
        try {
            connection = openConnection(downloadUrl);
            try (InputStream input = connection.getInputStream();
                 OutputStream output = resolver.openOutputStream(target, "w")) {
                if (output == null) {
                    throw new IllegalStateException("Android could not open the MediaDock download file.");
                }
                copy(input, output);
            }
            ContentValues complete = new ContentValues();
            complete.put(MediaStore.MediaColumns.IS_PENDING, 0);
            if (resolver.update(target, complete, null, null) == 0) {
                throw new IllegalStateException("Android could not finish the MediaDock download.");
            }
            String selection = MediaStore.MediaColumns.DISPLAY_NAME + "=? AND "
                + MediaStore.MediaColumns.RELATIVE_PATH + "=? AND "
                + MediaStore.MediaColumns.OWNER_PACKAGE_NAME + "=? AND "
                + MediaStore.MediaColumns._ID + "!=?";
            String[] selectionArgs = {
                filename,
                relativePath,
                getContext().getPackageName(),
                Long.toString(ContentUris.parseId(target))
            };
            resolver.delete(collection, selection, selectionArgs);
        } catch (Exception error) {
            resolver.delete(target, null, null);
            throw error;
        } finally {
            if (connection != null) connection.disconnect();
        }

        return target.toString();
    }

    private void delete(PluginCall call, String relativePath) {
        ioExecutor.execute(() -> {
            try {
                boolean deleted = deleteFile(relativePath);
                JSObject result = new JSObject();
                result.put("deleted", deleted);
                call.resolve(result);
            } catch (Exception error) {
                String message = error.getMessage();
                call.reject(message == null ? "Could not remove the MediaDock download." : message);
            }
        });
    }

    private boolean deleteFile(String relativePath) {
        String[] segments = relativePath.split("/");
        String filename = segments[segments.length - 1];
        StringBuilder directory = new StringBuilder();
        for (int index = 0; index < segments.length - 1; index++) {
            if (index > 0) directory.append('/');
            directory.append(segments[index]);
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            File target = new File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                "MediaDock/" + directory + "/" + filename
            );
            return !target.exists() || target.delete();
        }

        String mediaDirectory = ensureTrailingSlash(
            Environment.DIRECTORY_DOWNLOADS + "/MediaDock/" + directory
        );
        String selection = MediaStore.MediaColumns.DISPLAY_NAME + "=? AND "
            + MediaStore.MediaColumns.RELATIVE_PATH + "=? AND "
            + MediaStore.MediaColumns.OWNER_PACKAGE_NAME + "=?";
        String[] selectionArgs = {
            filename,
            mediaDirectory,
            getContext().getPackageName()
        };
        int deleted = getContext().getContentResolver().delete(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            selection,
            selectionArgs
        );
        return deleted > 0;
    }

    private Uri findDownloadUri(String relativePath) throws Exception {
        String[] segments = relativePath.split("/");
        String filename = segments[segments.length - 1];
        StringBuilder directory = new StringBuilder();
        for (int index = 0; index < segments.length - 1; index++) {
            if (index > 0) directory.append('/');
            directory.append(segments[index]);
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            File file = new File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                "MediaDock/" + directory + "/" + filename
            );
            if (!file.isFile()) {
                throw new java.io.FileNotFoundException("The saved MediaDock file was not found.");
            }
            return Uri.fromFile(file);
        }

        String mediaDirectory = ensureTrailingSlash(
            Environment.DIRECTORY_DOWNLOADS + "/MediaDock/" + directory
        );
        String selection = MediaStore.MediaColumns.DISPLAY_NAME + "=? AND "
            + MediaStore.MediaColumns.RELATIVE_PATH + "=? AND "
            + MediaStore.MediaColumns.OWNER_PACKAGE_NAME + "=?";
        String[] selectionArgs = {
            filename,
            mediaDirectory,
            getContext().getPackageName()
        };
        try (Cursor cursor = getContext().getContentResolver().query(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            new String[] { MediaStore.MediaColumns._ID },
            selection,
            selectionArgs,
            MediaStore.MediaColumns.DATE_ADDED + " DESC"
        )) {
            if (cursor == null || !cursor.moveToFirst()) {
                throw new java.io.FileNotFoundException("The saved MediaDock file was not found.");
            }
            long id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID));
            return ContentUris.withAppendedId(MediaStore.Downloads.EXTERNAL_CONTENT_URI, id);
        }
    }

    private static HttpURLConnection openConnection(String downloadUrl) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(downloadUrl).openConnection();
        connection.setInstanceFollowRedirects(true);
        connection.setConnectTimeout(30_000);
        connection.setReadTimeout(120_000);
        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            connection.disconnect();
            throw new IllegalStateException(
                "The media server returned HTTP " + status + " while saving the download."
            );
        }
        return connection;
    }

    private static void copy(InputStream input, OutputStream output) throws Exception {
        if (input == null) {
            throw new IllegalStateException("The completed MediaDock download is missing.");
        }
        byte[] buffer = new byte[64 * 1024];
        int count;
        while ((count = input.read(buffer)) != -1) {
            output.write(buffer, 0, count);
        }
        output.flush();
    }

    private static String mimeType(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) return "application/octet-stream";
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(
            filename.substring(dot + 1).toLowerCase()
        );
        return mime == null ? "application/octet-stream" : mime;
    }

    private static String ensureTrailingSlash(String path) {
        return path.endsWith("/") ? path : path + "/";
    }

    private static void validateUrl(String downloadUrl) {
        if (downloadUrl == null || !(downloadUrl.startsWith("https://") || downloadUrl.startsWith("http://"))) {
            throw new IllegalArgumentException("The media download URL is invalid.");
        }
    }

    private static void validateFilename(String filename) {
        if (filename == null || filename.isEmpty() || filename.equals(".") || filename.equals("..")
            || filename.contains("/") || filename.contains("\\") || filename.contains(":")) {
            throw new IllegalArgumentException("The download filename is not safe.");
        }
    }

    private static void validateDirectory(String directory) {
        String[] segments = validateRelativePath(directory + "/placeholder");
        String category = segments[0];
        if (!category.equals("videos") && !category.equals("audios")
            && !category.equals("images") && !category.equals("documents")
            && !category.equals("files")) {
            throw new IllegalArgumentException("The MediaDock media folder is not valid.");
        }
    }

    private static String[] validateRelativePath(String path) {
        if (path == null || path.isEmpty() || path.startsWith("/") || path.contains("\\")) {
            throw new IllegalArgumentException("The MediaDock file path is not safe.");
        }
        String[] segments = path.split("/");
        List<String> validated = new ArrayList<>();
        for (String segment : segments) {
            if (segment.isEmpty() || segment.equals(".") || segment.equals("..")
                || segment.contains(":")) {
                throw new IllegalArgumentException("The MediaDock file path is not safe.");
            }
            validated.add(segment);
        }
        return validated.toArray(new String[0]);
    }
}
