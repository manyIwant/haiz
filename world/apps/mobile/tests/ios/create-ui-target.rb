# Adds a CI-only UI test target to the real Capacitor project without changing app runtime.
require 'xcodeproj'
project_path = 'ios/App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.name == 'App' }
raise 'App target missing' unless app
name = 'HAIZUITests'
target = project.targets.find { |item| item.name == name } || project.new_target(:ui_test_bundle, name, :ios, '15.0')
target.add_dependency(app) unless target.dependencies.any? { |dependency| dependency.target == app }
group = project.main_group.find_subpath('HAIZUITests', true)
# Source lives outside ios/App, relative to the project directory.
ref = group.files.find { |file| file.path == '../../tests/ios/StartupTests.swift' } || group.new_file('../../tests/ios/StartupTests.swift')
target.source_build_phase.add_file_reference(ref, true)
target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'space.haiz.study.qa'
  config.build_settings['PRODUCT_NAME'] = 'HAIZUITests'
  config.build_settings['PRODUCT_MODULE_NAME'] = 'HAIZUITests'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['TEST_TARGET_NAME'] = 'App'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.set_launch_target(app)
scheme.save_as(project_path, 'HAIZQA', true)
puts 'Generated HAIZQA scheme and real WKWebView UI test target'
