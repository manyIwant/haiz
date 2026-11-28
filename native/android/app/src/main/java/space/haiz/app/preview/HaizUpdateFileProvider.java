package space.haiz.app.preview;

import androidx.core.content.FileProvider;

/** Serves only cache/haiz_updates/ to the system package installer. */
public class HaizUpdateFileProvider extends FileProvider {
    public HaizUpdateFileProvider() { super(R.xml.update_paths); }
}
